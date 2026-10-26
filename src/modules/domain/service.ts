import { EstadoFisico, PapelUsuario, StatusContrato, StatusRastreamento } from "@prisma/client";
import { DomainRepository } from "./repository.js";
import { AppError, conflict, forbidden, notFound } from "../../shared/errors.js";
import { hashPassword } from "../../shared/password.js";

const transitions: Record<StatusRastreamento, StatusRastreamento[]> = {
  RECEBIDO: ["EM_TRIAGEM"], EM_TRIAGEM: ["APTO_REUSO", "APTO_RECICLAGEM"],
  APTO_REUSO: ["EM_DESMONTE", "DESCARTADO"], APTO_RECICLAGEM: ["EM_DESMONTE", "DESCARTADO"],
  EM_DESMONTE: ["DESCARTADO"], DESCARTADO: [],
};

export class DomainService {
  constructor(readonly repo: DomainRepository) {}
  private allow(user: { papel: PapelUsuario }, roles: PapelUsuario[]) { if (!roles.includes(user.papel)) throw forbidden(); }
  private async versionUpdate(model: "organizacao" | "contrato" | "lote", id: string, versao: number, data: Record<string, unknown>) {
    const count = await this.repo.updateVersioned(model, id, versao, data);
    if (!count.count) throw conflict("Registro alterado por outra requisicao; recarregue e tente novamente.");
  }

  async createOrganization(user: { papel: PapelUsuario }, input: any) {
    this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const cnpj = validateCnpj(input.cnpj);
    return this.repo.createOrganization({ razaoSocial: input.razaoSocial.trim(), nomeFantasia: input.nomeFantasia.trim(), cnpj });
  }
  organizations(user: { papel: PapelUsuario }) { this.allow(user, Object.values(PapelUsuario)); return this.repo.organizations(); }
  async createContract(user: { papel: PapelUsuario }, input: any) {
    this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const org = await this.repo.findActiveOrganization(input.organizacaoId);
    if (!org) throw notFound("Organizacao ativa nao encontrada.");
    if (input.dataFim && input.dataFim < input.dataInicio) throw new AppError("Data final anterior a data inicial.");
    return this.repo.createContract({ organizacao: { connect: { id: org.id } }, codigo: input.codigo.trim(), dataInicio: new Date(`${input.dataInicio}T00:00:00.000Z`), dataFim: input.dataFim ? new Date(`${input.dataFim}T00:00:00.000Z`) : null, valor: input.valor ?? 0, ...(input.clausulas ? { clausulas: input.clausulas } : {}) });
  }
  contracts(user: { papel: PapelUsuario }, orgId?: string) { this.allow(user, Object.values(PapelUsuario)); return this.repo.contracts(orgId); }
  async createLot(user: { papel: PapelUsuario; sub: string }, input: any) {
    this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    const [org, contract] = await Promise.all([this.repo.findActiveOrganization(input.organizacaoId), this.repo.findContract(input.contratoId)]);
    if (!org || !contract || contract.organizacaoId !== org.id || contract.status !== StatusContrato.ATIVO || contract.dataInicio > new Date(input.dataEntrada) || (contract.dataFim && contract.dataFim < new Date(input.dataEntrada))) throw new AppError("Organizacao ativa e contrato valido para a data do lote sao obrigatorios.");
    const data = { organizacaoId: org.id, contratoId: contract.id, numeroNotaFiscal: input.numeroNotaFiscal.trim(), transportadora: input.transportadora.trim(), dataEntrada: new Date(`${input.dataEntrada}T00:00:00.000Z`) };
    return this.repo.transaction(async tx => {
      const lot = await this.repo.createLot(tx, { ...data, organizacao: { connect: { id: data.organizacaoId } }, contrato: { connect: { id: data.contratoId } } });
      for (const item of input.equipamentos ?? []) {
        const codigo = validateBarcode(item.codigoBarras);
        await this.repo.createEquipment(tx, { lote: { connect: { id: lot.id } }, codigoBarrasInterno: codigo, tipo: item.tipo, estadoFisico: item.estadoFisico, movimentacoes: { create: { usuario: { connect: { id: user.sub } }, statusAnterior: "RECEBIDO", statusNovo: "RECEBIDO", estadoFisicoAnterior: item.estadoFisico, estadoFisicoNovo: item.estadoFisico, observacao: "Entrada no sistema." } } });
      }
      return lot;
    });
  }
  lots(user: { papel: PapelUsuario }) { this.allow(user, Object.values(PapelUsuario)); return this.repo.lots(); }
  equipments(user: { papel: PapelUsuario }) { this.allow(user, Object.values(PapelUsuario)); return this.repo.equipments(); }
  movements(user: { papel: PapelUsuario }, equipmentId?: string) { this.allow(user, Object.values(PapelUsuario)); return this.repo.movements(equipmentId); }
  async addEquipment(user: { papel: PapelUsuario; sub: string }, input: any) {
    this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    if (!(await this.repo.findLot(input.loteId))) throw notFound("Lote nao encontrado.");
    const code = validateBarcode(input.codigoBarras);
    return this.repo.transaction(tx => this.repo.createEquipment(tx, { lote: { connect: { id: input.loteId } }, codigoBarrasInterno: code, tipo: input.tipo, estadoFisico: input.estadoFisico, movimentacoes: { create: { usuario: { connect: { id: user.sub } }, statusAnterior: "RECEBIDO", statusNovo: "RECEBIDO", estadoFisicoAnterior: input.estadoFisico, estadoFisicoNovo: input.estadoFisico, observacao: "Entrada no sistema." } } }));
  }
  async moveEquipment(user: { papel: PapelUsuario; sub: string }, id: string, input: any) {
    this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    return this.repo.transaction(async tx => {
      const previous = await this.repo.findEquipmentForUpdate(tx, id);
      if (!previous) throw notFound("Equipamento nao encontrado.");
      const target = input.status as StatusRastreamento;
      if (target !== previous.status && !transitions[previous.status].includes(target)) throw new AppError("Transicao de rastreamento nao permitida.");
      if (target === "EM_DESMONTE" && !previous.triagemCompleta) throw new AppError("Triagem completa obrigatoria antes do desmonte.");
      const physicalRank: Record<EstadoFisico, number> = { INSERVIVEL: 0, PESSIMO: 1, RUIM: 2, REGULAR: 3, BOM: 4 };
      if (physicalRank[previous.estadoFisico] - physicalRank[input.estadoFisico as EstadoFisico] >= 2 && !input.justificativa?.trim()) throw new AppError("Justificativa obrigatoria para queda de duas categorias ou mais.");
      const update = await this.repo.updateEquipment(tx, id, input.versao ?? previous.versao, { status: target, estadoFisico: input.estadoFisico, ...(input.triagemCompleta === true ? { triagemCompleta: true } : {}) });
      if (!update.count) throw conflict("Equipamento alterado por outra requisicao; recarregue e tente novamente.");
      await this.repo.createMovement(tx, { equipamento: { connect: { id } }, usuario: { connect: { id: user.sub } }, statusAnterior: previous.status, statusNovo: target, estadoFisicoAnterior: previous.estadoFisico, estadoFisicoNovo: input.estadoFisico, justificativa: input.justificativa, observacao: input.observacao });
      return this.repo.findEquipmentFromTransaction(tx, id);
    });
  }
  async trace(user: { papel: PapelUsuario }, barcode: string) {
    this.allow(user, Object.values(PapelUsuario));
    const equipment = await this.repo.findEquipmentByBarcode(validateBarcode(barcode));
    if (!equipment) throw notFound("Equipamento nao encontrado.");
    return equipment;
  }
  async createUser(user: { papel: PapelUsuario }, input: any) {
    this.allow(user, ["ADMINISTRADOR"]);
    const pwd = hashPassword(input.senha);
    return this.repo.createUser({ login: input.login.trim().toLowerCase(), nome: input.nome.trim(), papel: input.papel, senhaSalt: pwd.salt, senhaHash: pwd.hash });
  }
  users(user: { papel: PapelUsuario }) {
    this.allow(user, ["ADMINISTRADOR"]);
    return this.repo.users();
  }
  async setUserActive(user: { papel: PapelUsuario }, id: string, ativo: boolean) {
    this.allow(user, ["ADMINISTRADOR"]);
    const result = await this.repo.setUserActive(id, ativo);
    if (!result) throw notFound("Usuario nao encontrado.");
    if ("ultimoAdministrador" in result) throw new AppError("Nao e permitido desativar o ultimo administrador ativo.");
    if ("conflito" in result) throw conflict("Usuario alterado por outra requisicao; recarregue e tente novamente.");
    return result.usuario;
  }
  async getGlobalConfiguration(user: { papel: PapelUsuario }) {
    this.allow(user, ["ADMINISTRADOR"]);
    return (await this.repo.globalConfiguration()) ?? { id: "global", aliquotaImposto: 0, coeficienteDepreciacao: 0, atualizadoEm: new Date(0), versao: 1 };
  }
  async updateGlobalConfiguration(user: { papel: PapelUsuario }, input: any) {
    this.allow(user, ["ADMINISTRADOR"]);
    for (const field of ["aliquotaImposto", "coeficienteDepreciacao"] as const) {
      const value = input.data[field];
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new AppError(`${field} deve estar entre 0 e 1.`);
    }
    const current = await this.repo.globalConfiguration();
    if (!current) throw notFound("Configuracao global nao encontrada; rode o seed.");
    const result = await this.repo.saveGlobalConfiguration(input.versao, input.data);
    if (!result.count) throw conflict("Configuracao alterada por outra requisicao; recarregue e tente novamente.");
    return this.getGlobalConfiguration(user);
  }
  async updateOrganization(user: { papel: PapelUsuario }, id: string, input: any) { this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]); await this.versionUpdate("organizacao", id, input.versao, input.data); return this.repo.findOrganizationOrThrow(id); }
  async updateContract(user: { papel: PapelUsuario }, id: string, input: any) { this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]); await this.versionUpdate("contrato", id, input.versao, input.data); return this.repo.findContractOrThrow(id); }
  async updateLot(user: { papel: PapelUsuario }, id: string, input: any) { this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); await this.versionUpdate("lote", id, input.versao, input.data); return this.repo.findLotOrThrow(id); }
  async removeOrganization(user: { papel: PapelUsuario }, id: string) { this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]); await this.repo.removeOrganization(id); }
  async removeContract(user: { papel: PapelUsuario }, id: string) { this.allow(user, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]); await this.repo.removeContract(id); }
  async removeLot(user: { papel: PapelUsuario }, id: string) { this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); await this.repo.removeLot(id); }
  async removeEquipment(user: { papel: PapelUsuario }, id: string) { this.allow(user, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); await this.repo.removeEquipment(id); }
}

function validateBarcode(input: string): string { const value = input.trim().toUpperCase(); if (!/^[A-Z0-9-]{4,40}$/.test(value)) throw new AppError("Codigo de barras interno invalido."); return value; }
function validateCnpj(input: string): string {
  const value = input.replace(/[.\-/\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^([0-9])\1{13}$/.test(value)) throw new AppError("CNPJ deve conter 12 caracteres alfanumericos e 2 digitos verificadores.");
  const digit = (base: string, weights: number[]) => { const sum = [...base].reduce((n, ch, i) => n + Math.max(0, ch.charCodeAt(0) - 48) * weights[i]!, 0); const rem = sum % 11; return rem < 2 ? 0 : 11 - rem; };
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2], weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const first = digit(value.slice(0,12), weights1), second = digit(value.slice(0,12) + first, weights2);
  if (value.slice(-2) !== `${first}${second}`) throw new AppError("Digitos verificadores do CNPJ invalidos.");
  return value;
}
