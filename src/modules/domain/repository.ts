import type { Prisma, PrismaClient } from "@prisma/client";

export class DomainRepository {
  constructor(private readonly db: PrismaClient) {}
  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) { return this.db.$transaction(run); }
  findActiveOrganization(id: string) { return this.db.organizacao.findFirst({ where: { id, ativa: true } }); }
  findContract(id: string) { return this.db.contrato.findUnique({ where: { id } }); }
  findLot(id: string) { return this.db.lote.findUnique({ where: { id } }); }
  findEquipmentByBarcode(code: string) { return this.db.equipamento.findUnique({ where: { codigoBarrasInterno: code }, include: { lote: { include: { organizacao: true, contrato: true } }, movimentacoes: { include: { usuario: { select: { id: true, login: true, nome: true } } }, orderBy: { data: "asc" } } } }); }
  findEquipmentForUpdate(tx: Prisma.TransactionClient, id: string) { return tx.equipamento.findUnique({ where: { id } }); }
  createMovement(tx: Prisma.TransactionClient, data: Prisma.MovimentacaoCreateInput) { return tx.movimentacao.create({ data }); }
  findEquipmentFromTransaction(tx: Prisma.TransactionClient, id: string) { return tx.equipamento.findUniqueOrThrow({ where: { id } }); }
  createOrganization(data: Prisma.OrganizacaoCreateInput) { return this.db.organizacao.create({ data }); }
  createContract(data: Prisma.ContratoCreateInput) { return this.db.contrato.create({ data }); }
  createLot(tx: Prisma.TransactionClient, data: Prisma.LoteCreateInput) { return tx.lote.create({ data }); }
  createEquipment(tx: Prisma.TransactionClient, data: Prisma.EquipamentoCreateInput) { return tx.equipamento.create({ data }); }
  createUser(data: Prisma.UsuarioCreateInput) { return this.db.usuario.create({ data, select: { id: true, login: true, nome: true, papel: true, ativo: true, versao: true } }); }
  async updateVersioned(model: "organizacao" | "contrato" | "lote", id: string, versao: number, data: Record<string, unknown>) {
    return (this.db[model] as any).updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
  }
  findOrganizationOrThrow(id: string) { return this.db.organizacao.findUniqueOrThrow({ where: { id } }); }
  findContractOrThrow(id: string) { return this.db.contrato.findUniqueOrThrow({ where: { id } }); }
  findLotOrThrow(id: string) { return this.db.lote.findUniqueOrThrow({ where: { id } }); }
  findEquipmentOrThrow(id: string) { return this.db.equipamento.findUniqueOrThrow({ where: { id } }); }
  removeOrganization(id: string) { return this.db.organizacao.delete({ where: { id } }); }
  removeContract(id: string) { return this.db.contrato.delete({ where: { id } }); }
  removeLot(id: string) { return this.db.lote.delete({ where: { id } }); }
  removeEquipment(id: string) { return this.db.equipamento.delete({ where: { id } }); }
  globalConfiguration() { return this.db.configuracaoGlobal.findUnique({ where: { id: "global" } }); }
  async saveGlobalConfiguration(versao: number, data: { aliquotaImposto: number; coeficienteDepreciacao: number }) {
    return this.db.configuracaoGlobal.updateMany({ where: { id: "global", versao }, data: { ...data, versao: { increment: 1 } } });
  }
  organization(id: string) { return this.db.organizacao.findUnique({ where: { id }, include: { contrato: true } }); }
  organizations() { return this.db.organizacao.findMany({ include: { contrato: true }, orderBy: { criadaEm: "desc" } }); }
  contracts(orgId?: string) { return this.db.contrato.findMany({ where: orgId ? { organizacaoId: orgId } : undefined, include: { organizacao: true }, orderBy: { criadoEm: "desc" } }); }
  lots() { return this.db.lote.findMany({ include: { organizacao: true, contrato: true, _count: { select: { equipamentos: true } } }, orderBy: { criadoEm: "desc" } }); }
  equipment(id: string) { return this.db.equipamento.findUnique({ where: { id }, include: { lote: { include: { organizacao: true, contrato: true } }, movimentacoes: { include: { usuario: { select: { id: true, login: true, nome: true } } }, orderBy: { data: "asc" } } } }); }
  equipments() { return this.db.equipamento.findMany({ include: { lote: true }, orderBy: { criadoEm: "desc" } }); }
  movements(equipmentId?: string) { return this.db.movimentacao.findMany({ where: equipmentId ? { equipamentoId: equipmentId } : undefined, include: { equipamento: true, usuario: { select: { id: true, login: true, nome: true } } }, orderBy: { data: "asc" } }); }
  async updateEquipment(tx: Prisma.TransactionClient, id: string, versao: number, data: Prisma.EquipamentoUpdateManyMutationInput) {
    return tx.equipamento.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
  }
}
