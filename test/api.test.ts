import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildApp } from "../src/app.js";

const password = process.env.SEED_PASSWORD ?? "GreenCode123!";
let app: Awaited<ReturnType<typeof buildApp>>;

before(async () => { app = await buildApp(); });
after(async () => { await app.close(); });

describe("API GreenCode", () => {
  it("mantem health publico", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("disponibiliza documentacao Swagger", async () => {
    const response = await app.inject({ method: "GET", url: "/docs/json" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().info.title, "GreenCode API");
  });

  it("recusa requisicao sem JWT", async () => {
    const response = await app.inject({ method: "GET", url: "/organizacoes" });
    assert.equal(response.statusCode, 401);
  });

  it("faz login e aceita JWT em rota protegida", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "admin@greencode.local", senha: password } });
    assert.equal(login.statusCode, 200);
    const token = login.json().token as string;
    assert.ok(token);
    const result = await app.inject({ method: "GET", url: "/organizacoes", headers: { authorization: `Bearer ${token}` } });
    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.json()));
  });

  it("restringe criacao de organizacao por papel", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "auditor@greencode.local", senha: password } });
    assert.equal(login.statusCode, 200);
    const result = await app.inject({ method: "POST", url: "/organizacoes", headers: { authorization: `Bearer ${login.json().token}` }, payload: { razaoSocial: "Teste", nomeFantasia: "Teste", cnpj: "11222333000181" } });
    assert.equal(result.statusCode, 403);
  });

  it("entrega equipamentos com estados variados do seed", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "admin@greencode.local", senha: password } });
    const result = await app.inject({ method: "GET", url: "/equipamentos", headers: { authorization: `Bearer ${login.json().token}` } });
    assert.equal(result.statusCode, 200);
    const statuses = new Set((result.json() as Array<{ status: string }>).map(item => item.status));
    assert.ok(statuses.size >= 3);
  });

  it("valida transicao e rejeita versao concorrente", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "admin@greencode.local", senha: password } });
    const authorization = { authorization: `Bearer ${login.json().token}` };
    const list = await app.inject({ method: "GET", url: "/equipamentos", headers: authorization });
    const equipment = (list.json() as Array<{ id: string; status: string; estadoFisico: string; versao: number }>).find(item => item.status === "RECEBIDO");
    assert.ok(equipment);
    const movement = { status: "EM_TRIAGEM", estadoFisico: equipment.estadoFisico, versao: equipment.versao };
    const changed = await app.inject({ method: "PATCH", url: `/equipamentos/${equipment.id}/movimentacoes`, headers: authorization, payload: movement });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().versao, equipment.versao + 1);
    const stale = await app.inject({ method: "PATCH", url: `/equipamentos/${equipment.id}/movimentacoes`, headers: authorization, payload: movement });
    assert.equal(stale.statusCode, 409);
  });
});
