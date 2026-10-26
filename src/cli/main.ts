import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { ApiClient } from "./ApiClient.js";
import { CLIInterface } from "./CLIInterface.js";
import { perguntarSenha } from "./EntradaTerminal.js";

interface LoginResponse {
  token: string;
  usuario: { login: string; papel: "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR" };
}

async function perguntar(texto: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(texto);
  } finally {
    terminal.close();
  }
}

async function iniciar(): Promise<void> {
  const baseUrl = (process.env.GREENCODE_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3333"}`).replace(/\/+$/, "");
  const api = new ApiClient(baseUrl);
  await api.request("/health", { authenticated: false });
  console.log(`GreenCode AV2 - Interface de terminal\nAPI: ${baseUrl}`);

  while (true) {
    const login = await perguntar("Login: ");
    const senha = await perguntarSenha("Senha: ");
    try {
      const resposta = await api.request<LoginResponse>("/auth/login", {
        method: "POST",
        body: { login, senha },
        authenticated: false,
      });
      api.setToken(resposta.token);
      await new CLIInterface(api, resposta.usuario).iniciar();
      return;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      console.error(`[ERRO] ${error.message}`);
      if (error.message.startsWith("Nao foi possivel conectar")) throw error;
    }
  }
}

iniciar().catch(error => {
  console.error(`[ERRO] ${error instanceof Error ? error.message : "Falha ao iniciar a interface."}`);
  process.exitCode = 1;
});
