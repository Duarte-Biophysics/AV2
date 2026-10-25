import { PrismaClient, EstadoFisico, PapelUsuario, StatusRastreamento, TipoEquipamento } from "@prisma/client";
import { hashPassword } from "../src/shared/password.js";

const prisma = new PrismaClient();
const demoPassword = process.env.SEED_PASSWORD ?? "GreenCode123!";

async function main() {
  const users = [
    ["admin@greencode.local", "Administrador GreenCode", PapelUsuario.ADMINISTRADOR],
    ["cadastro@greencode.local", "Operador de cadastro", PapelUsuario.OPERADOR_CADASTRO],
    ["almoxarifado@greencode.local", "Gestor de almoxarifado", PapelUsuario.GESTOR_ALMOXARIFADO],
    ["auditor@greencode.local", "Auditor GreenCode", PapelUsuario.AUDITOR],
  ] as const;
  for (const [login, nome, papel] of users) {
    const credential = hashPassword(demoPassword);
    await prisma.usuario.upsert({ where: { login }, update: { nome, papel, ativo: true, senhaHash: credential.hash, senhaSalt: credential.salt }, create: { login, nome, papel, senhaHash: credential.hash, senhaSalt: credential.salt } });
  }
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { login: users[0][0] } });
  const org = await prisma.organizacao.upsert({ where: { cnpj: "11222333000181" }, update: {}, create: { razaoSocial: "Instituto GreenCode Exemplo", nomeFantasia: "GreenCode Exemplo", cnpj: "11222333000181" } });
  const contract = await prisma.contrato.upsert({ where: { codigo: "GC-CONTRATO-001" }, update: {}, create: { organizacaoId: org.id, codigo: "GC-CONTRATO-001", valor: 12500, clausulas: { escopo: "Recebimento e destinacao de equipamentos", prazoDias: 365 }, dataInicio: new Date("2025-01-01T00:00:00.000Z"), dataFim: new Date("2030-12-31T00:00:00.000Z") } });
  const lot = await prisma.lote.upsert({ where: { id: "00000000-0000-4000-8000-000000000001" }, update: {}, create: { id: "00000000-0000-4000-8000-000000000001", organizacaoId: org.id, contratoId: contract.id, numeroNotaFiscal: "NF-DEMO-001", transportadora: "Transporte Green", dataEntrada: new Date("2026-01-15T00:00:00.000Z"), status: "RECEBIDO" } });
  const samples = [
    { code: "GC-DEMO-001", status: StatusRastreamento.RECEBIDO, state: EstadoFisico.BOM, complete: false },
    { code: "GC-DEMO-002", status: StatusRastreamento.EM_TRIAGEM, state: EstadoFisico.REGULAR, complete: false },
    { code: "GC-DEMO-003", status: StatusRastreamento.APTO_REUSO, state: EstadoFisico.BOM, complete: true },
    { code: "GC-DEMO-004", status: StatusRastreamento.DESCARTADO, state: EstadoFisico.INSERVIVEL, complete: true },
  ];
  for (const item of samples) {
    const equipment = await prisma.equipamento.upsert({ where: { codigoBarrasInterno: item.code }, update: { status: item.status, estadoFisico: item.state, triagemCompleta: item.complete }, create: { loteId: lot.id, codigoBarrasInterno: item.code, tipo: TipoEquipamento.COMPUTADOR, estadoFisico: item.state, status: item.status, triagemCompleta: item.complete } });
    const historic = await prisma.movimentacao.count({ where: { equipamentoId: equipment.id } });
    if (!historic) {
      const history = item.status === "DESCARTADO" ? ["RECEBIDO", "EM_TRIAGEM", "APTO_RECICLAGEM", "EM_DESMONTE", "DESCARTADO"] : item.status === "APTO_REUSO" ? ["RECEBIDO", "EM_TRIAGEM", "APTO_REUSO"] : item.status === "EM_TRIAGEM" ? ["RECEBIDO", "EM_TRIAGEM"] : ["RECEBIDO"];
      let previous = "RECEBIDO";
      for (const status of history) {
        await prisma.movimentacao.create({ data: { equipamentoId: equipment.id, usuarioId: admin.id, statusAnterior: previous as any, statusNovo: status as any, estadoFisicoAnterior: item.state, estadoFisicoNovo: item.state, observacao: "Movimentacao de demonstracao." } });
        previous = status;
      }
    }
  }
  await prisma.configuracaoGlobal.upsert({ where: { id: "global" }, update: {}, create: { id: "global", aliquotaImposto: 0, coeficienteDepreciacao: 0 } });
  console.log(`Seed concluido. Contas de demonstracao usam a senha definida por SEED_PASSWORD (padrao: ${demoPassword}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
