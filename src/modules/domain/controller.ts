import type { FastifyInstance, FastifyRequest } from "fastify";
import { DomainService } from "./service.js";
import { DomainRepository } from "./repository.js";
import { AuthService } from "../auth/service.js";
import { AppError } from "../../shared/errors.js";

const idParams = { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } as const;
const versionSchema = { type: "integer", minimum: 1 } as const;
const errorResponse = { type: "object", properties: { error: { type: "string" }, statusCode: { type: "integer" } }, required: ["error", "statusCode"] } as const;
const user = (r: FastifyRequest) => r.user;

export async function registerControllers(app: FastifyInstance) {
  const domain = new DomainService(new DomainRepository(app.prisma));
  const auth = new AuthService(app);
  app.post("/auth/login", { config: { public: true }, schema: { tags: ["auth"], body: { type: "object", required: ["login", "senha"], properties: { login: { type: "string", minLength: 3 }, senha: { type: "string", minLength: 1 } } } } }, async req => auth.login((req.body as any).login, (req.body as any).senha));
  app.post("/usuarios", { schema: { tags: ["usuarios"], body: { type: "object", required: ["login", "nome", "senha", "papel"], properties: { login: { type: "string", minLength: 3, maxLength: 64 }, nome: { type: "string", minLength: 1 }, senha: { type: "string", minLength: 4 }, papel: { type: "string", enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] } } } } }, async (req, reply) => reply.code(201).send(await domain.createUser(user(req), req.body)));
  app.get("/usuarios", { schema: { tags: ["usuarios"] } }, req => domain.users(user(req)));
  app.patch("/usuarios/:id", { schema: { tags: ["usuarios"], params: idParams, body: { type: "object", required: ["ativo"], properties: { ativo: { type: "boolean" } } } } }, req => domain.setUserActive(user(req), (req.params as any).id, (req.body as any).ativo));
  app.get("/configuracao-global", { schema: { tags: ["sistema"] } }, req => domain.getGlobalConfiguration(user(req)));
  app.patch("/configuracao-global", { schema: { tags: ["sistema"], body: { type: "object", required: ["versao", "data"], properties: { versao: versionSchema, data: { type: "object", required: ["aliquotaImposto", "coeficienteDepreciacao"], properties: { aliquotaImposto: { type: "number", minimum: 0, maximum: 1 }, coeficienteDepreciacao: { type: "number", minimum: 0, maximum: 1 } }, minProperties: 2 } } } } }, req => domain.updateGlobalConfiguration(user(req), req.body));

  app.get("/organizacoes", { schema: { tags: ["organizacoes"] } }, req => domain.organizations(user(req)));
  app.post("/organizacoes", { schema: { tags: ["organizacoes"], body: { type: "object", required: ["razaoSocial", "nomeFantasia", "cnpj"], properties: { razaoSocial: { type: "string", minLength: 1 }, nomeFantasia: { type: "string", minLength: 1 }, cnpj: { type: "string", minLength: 14, maxLength: 18 } } } } }, async (req, reply) => reply.code(201).send(await domain.createOrganization(user(req), req.body)));
  app.patch("/organizacoes/:id", { schema: { tags: ["organizacoes"], params: idParams, body: { type: "object", required: ["versao", "data"], properties: { versao: versionSchema, data: { type: "object", properties: { razaoSocial: { type: "string" }, nomeFantasia: { type: "string" }, ativa: { type: "boolean" } }, minProperties: 1 } } } } }, (req) => domain.updateOrganization(user(req), (req.params as any).id, req.body));

  app.delete("/organizacoes/:id", { schema: { tags: ["organizacoes"], params: idParams } }, async (req, reply) => { await domain.removeOrganization(user(req), (req.params as any).id); return reply.code(204).send(); });
  app.get("/contratos", { schema: { tags: ["contratos"], querystring: { type: "object", properties: { organizacaoId: { type: "string", format: "uuid" } } } } }, req => domain.contracts(user(req), (req.query as any).organizacaoId));
  app.post("/contratos", { schema: { tags: ["contratos"], body: { type: "object", required: ["organizacaoId", "codigo", "dataInicio"], properties: { organizacaoId: { type: "string", format: "uuid" }, codigo: { type: "string", minLength: 1 }, dataInicio: { type: "string", format: "date" }, dataFim: { type: "string", format: "date" }, valor: { type: "number", minimum: 0 }, clausulas: { type: "object", additionalProperties: true } } } } }, async (req, reply) => reply.code(201).send(await domain.createContract(user(req), req.body)));
  app.patch("/contratos/:id", { schema: { tags: ["contratos"], params: idParams, body: { type: "object", required: ["versao", "data"], properties: { versao: versionSchema, data: { type: "object", properties: { codigo: { type: "string" }, valor: { type: "number", minimum: 0 }, dataFim: { type: "string", format: "date" }, status: { type: "string", enum: ["ATIVO", "ENCERRADO"] }, clausulas: { type: "object" } }, minProperties: 1 } } } } }, req => domain.updateContract(user(req), (req.params as any).id, req.body));

  app.delete("/contratos/:id", { schema: { tags: ["contratos"], params: idParams } }, async (req, reply) => { await domain.removeContract(user(req), (req.params as any).id); return reply.code(204).send(); });
  app.get("/lotes", { schema: { tags: ["lotes"] } }, req => domain.lots(user(req)));
  app.post("/lotes", { schema: { tags: ["lotes"], body: { type: "object", required: ["organizacaoId", "contratoId", "numeroNotaFiscal", "transportadora", "dataEntrada"], properties: { organizacaoId: { type: "string", format: "uuid" }, contratoId: { type: "string", format: "uuid" }, numeroNotaFiscal: { type: "string", minLength: 1 }, transportadora: { type: "string", minLength: 1 }, dataEntrada: { type: "string", format: "date" }, equipamentos: { type: "array", items: { type: "object", required: ["codigoBarras", "tipo", "estadoFisico"], properties: { codigoBarras: { type: "string" }, tipo: { type: "string", enum: ["COMPUTADOR", "NOTEBOOK", "CELULAR", "TABLET", "IMPRESSORA", "OUTRO"] }, estadoFisico: { type: "string", enum: ["INSERVIVEL", "PESSIMO", "RUIM", "REGULAR", "BOM"] } } } } } } } }, async (req, reply) => reply.code(201).send(await domain.createLot(user(req), req.body)));
  app.patch("/lotes/:id", { schema: { tags: ["lotes"], params: idParams, body: { type: "object", required: ["versao", "data"], properties: { versao: versionSchema, data: { type: "object", properties: { status: { type: "string", enum: ["RECEBIDO", "EM_TRIAGEM", "TRIADO", "FINALIZADO"] }, transportadora: { type: "string" }, numeroNotaFiscal: { type: "string" } }, minProperties: 1 } } } } }, req => domain.updateLot(user(req), (req.params as any).id, req.body));

  app.delete("/lotes/:id", { schema: { tags: ["lotes"], params: idParams } }, async (req, reply) => { await domain.removeLot(user(req), (req.params as any).id); return reply.code(204).send(); });
  app.get("/equipamentos", { schema: { tags: ["equipamentos"] } }, req => domain.equipments(user(req)));
  app.post("/equipamentos", { schema: { tags: ["equipamentos"], body: { type: "object", required: ["loteId", "codigoBarras", "tipo", "estadoFisico"], properties: { loteId: { type: "string", format: "uuid" }, codigoBarras: { type: "string" }, tipo: { type: "string", enum: ["COMPUTADOR", "NOTEBOOK", "CELULAR", "TABLET", "IMPRESSORA", "OUTRO"] }, estadoFisico: { type: "string", enum: ["INSERVIVEL", "PESSIMO", "RUIM", "REGULAR", "BOM"] } } } } }, async (req, reply) => reply.code(201).send(await domain.addEquipment(user(req), req.body)));
  app.patch("/equipamentos/:id/movimentacoes", { schema: { tags: ["equipamentos", "movimentacoes"], params: idParams, body: { type: "object", required: ["status", "estadoFisico", "versao"], properties: { status: { type: "string", enum: ["RECEBIDO", "EM_TRIAGEM", "APTO_REUSO", "APTO_RECICLAGEM", "EM_DESMONTE", "DESCARTADO"] }, estadoFisico: { type: "string", enum: ["INSERVIVEL", "PESSIMO", "RUIM", "REGULAR", "BOM"] }, versao: versionSchema, triagemCompleta: { type: "boolean" }, justificativa: { type: "string" }, observacao: { type: "string" } } } } }, req => domain.moveEquipment(user(req), (req.params as any).id, req.body));
  app.get("/equipamentos/:codigoBarras/rastreabilidade", { schema: { tags: ["movimentacoes"], params: { type: "object", required: ["codigoBarras"], properties: { codigoBarras: { type: "string" } } } } }, req => domain.trace(user(req), (req.params as any).codigoBarras));
  app.delete("/equipamentos/:id", { schema: { tags: ["equipamentos"], params: idParams } }, async (req, reply) => { await domain.removeEquipment(user(req), (req.params as any).id); return reply.code(204).send(); });
  app.get("/movimentacoes", { schema: { tags: ["movimentacoes"], querystring: { type: "object", properties: { equipamentoId: { type: "string", format: "uuid" } } } } }, req => domain.movements(user(req), (req.query as any).equipamentoId));
  app.setErrorHandler((error, _req, reply) => {
    const err = error as any;
    const statusCode = error instanceof AppError ? error.statusCode : ["P2002", "P2003", "P2034"].includes(err.code) ? 409 : err.code === "P2025" ? 404 : err.validation ? 400 : 500;
    app.log[statusCode >= 500 ? "error" : "info"](error);
    reply.code(statusCode).send({ error: statusCode === 500 ? "Erro interno do servidor." : (error instanceof Error ? error.message : "Erro na requisicao."), statusCode });
  });
}
