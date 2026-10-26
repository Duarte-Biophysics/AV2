import { createInterface, type Interface } from "node:readline";
import { ApiClient } from "./ApiClient.js";
import { interpretarComando, perguntarSenha } from "./EntradaTerminal.js";

type PapelUsuario = "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR";
type StatusRastreamento = "RECEBIDO" | "EM_TRIAGEM" | "APTO_REUSO" | "APTO_RECICLAGEM" | "EM_DESMONTE" | "DESCARTADO";
type EstadoFisico = "INSERVIVEL" | "PESSIMO" | "RUIM" | "REGULAR" | "BOM";

interface Usuario {
  id: string;
  login: string;
  nome: string;
  papel: PapelUsuario;
  ativo: boolean;
  versao: number;
}

interface Equipamento {
  id: string;
  codigoBarrasInterno: string;
  tipo: string;
  estadoFisico: EstadoFisico;
  status: StatusRastreamento;
  triagemCompleta: boolean;
  versao: number;
}

interface ConfiguracaoGlobal {
  versao: number;
}

const PAPEIS: PapelUsuario[] = ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"];
const TIPOS = ["COMPUTADOR", "NOTEBOOK", "CELULAR", "TABLET", "IMPRESSORA", "OUTRO"] as const;
const ESTADOS: EstadoFisico[] = ["INSERVIVEL", "PESSIMO", "RUIM", "REGULAR", "BOM"];
const STATUS: StatusRastreamento[] = ["RECEBIDO", "EM_TRIAGEM", "APTO_REUSO", "APTO_RECICLAGEM", "EM_DESMONTE", "DESCARTADO"];
const COMANDOS_POR_PAPEL: Record<PapelUsuario, string[]> = {
  ADMINISTRADOR: [
    "usuario criar", "usuario listar", "usuario desativar",
    "config obter", "config definir",
    "org criar", "org listar", "contrato criar", "contrato listar",
    "lote criar", "lote listar", "equip criar", "equip listar",
    "equip triagem-iniciar", "equip triagem-concluir", "equip movimentar", "relatorio rastrear",
  ],
  OPERADOR_CADASTRO: ["org criar", "org listar", "contrato criar", "contrato listar"],
  GESTOR_ALMOXARIFADO: [
    "lote criar", "lote listar", "equip criar", "equip listar",
    "equip triagem-iniciar", "equip triagem-concluir", "equip movimentar", "relatorio rastrear",
  ],
  AUDITOR: ["org listar", "contrato listar", "lote listar", "equip listar", "relatorio rastrear"],
};

export class CLIInterface {
  private terminal?: Interface & { history: string[] };

  constructor(
    private readonly api: ApiClient,
    private readonly usuario: { login: string; papel: PapelUsuario },
  ) {}

  async iniciar(): Promise<void> {
    const comandos = [...COMANDOS_POR_PAPEL[this.usuario.papel], "ajuda", "sair"];
    this.terminal = this.criarTerminal(comandos);
    console.log(`\nConectado como ${this.usuario.login} (${this.usuario.papel})`);
    console.log(`API: ${process.env.GREENCODE_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3333"}`}`);
    this.exibirMenuPorPapel();
    try {
      while (this.terminal) {
        const linha = await new Promise<string>(resolve => this.terminal!.question(`${this.usuario.login}> `, resolve));
        if (!linha.trim()) continue;
        this.terminal.history = [linha, ...this.terminal.history.filter(item => item !== linha)].slice(0, 500);
        try {
          if (!(await this.executarComando(linha))) break;
        } catch (error) {
          console.error(`[ERRO] ${error instanceof Error ? error.message : "Falha inesperada."}`);
        }
      }
    } finally {
      this.terminal?.close();
      this.terminal = undefined;
    }
  }

  private exibirMenuPorPapel(): void {
    console.log("Comandos disponiveis:");
    for (const comando of COMANDOS_POR_PAPEL[this.usuario.papel]) console.log(`  ${comando}`);
    console.log("  ajuda\n  sair");
  }

  private async executarComando(linha: string): Promise<boolean> {
    const comando = interpretarComando(linha);
    const opcoes = comando.opcoes;
    if (comando.grupo === "sair" || comando.grupo === "logout") {
      console.log("[INFO] Sessao encerrada.");
      return false;
    }
    if (comando.grupo === "ajuda") {
      this.exibirMenuPorPapel();
      return true;
    }

    let resultado: unknown;
    let mensagem: string;
    if (comando.grupo === "usuario" && comando.acao === "criar") {
      const login = await this.opcaoOuPerguntar(opcoes, "login", "Login do novo usuario: ");
      const nome = await this.opcaoOuPerguntar(opcoes, "nome", "Nome completo do novo usuario: ");
      const papel = converterEnum(await this.opcaoOuPerguntar(opcoes, "papel", `Papel (${PAPEIS.join(", ")}): `), PAPEIS, "papel");
      const senha = await this.perguntarSenha("Senha do novo usuario (minimo 4 caracteres): ");
      resultado = await this.api.request("/usuarios", { method: "POST", body: { login, nome, papel, senha } });
      mensagem = "Usuario criado.";
    } else if (comando.grupo === "usuario" && comando.acao === "listar") {
      resultado = await this.api.request("/usuarios");
      mensagem = "Usuarios cadastrados.";
    } else if (comando.grupo === "usuario" && comando.acao === "desativar") {
      const id = await this.opcaoOuPerguntar(opcoes, "id", "ID do usuario a desativar: ");
      resultado = await this.api.request(`/usuarios/${encodeURIComponent(id)}`, { method: "PATCH", body: { ativo: false } });
      mensagem = "Usuario desativado e sessoes revogadas.";
    } else if (comando.grupo === "config" && comando.acao === "obter") {
      resultado = await this.api.request("/configuracao-global");
      mensagem = "Configuracao global atual.";
    } else if (comando.grupo === "config" && comando.acao === "definir") {
      const configuracao = await this.api.request<ConfiguracaoGlobal>("/configuracao-global");
      resultado = await this.api.request("/configuracao-global", {
        method: "PATCH",
        body: {
          versao: configuracao.versao,
          data: {
            aliquotaImposto: parseNumero(await this.opcaoOuPerguntar(opcoes, "aliquota", "Aliquota de imposto (0 a 1): "), "aliquota"),
            coeficienteDepreciacao: parseNumero(await this.opcaoOuPerguntar(opcoes, "depreciacao", "Coeficiente de depreciacao (0 a 1): "), "depreciacao"),
          },
        },
      });
      mensagem = "Configuracao global atualizada.";
    } else if (comando.grupo === "org" && comando.acao === "criar") {
      resultado = await this.api.request("/organizacoes", {
        method: "POST",
        body: {
          razaoSocial: await this.opcaoOuPerguntar(opcoes, "razao", "Razao social: "),
          nomeFantasia: await this.opcaoOuPerguntar(opcoes, "nome", "Nome fantasia: "),
          cnpj: await this.opcaoOuPerguntar(opcoes, "cnpj", "CNPJ: "),
        },
      });
      mensagem = "Organizacao criada.";
    } else if (comando.grupo === "org" && comando.acao === "listar") {
      resultado = await this.api.request("/organizacoes");
      mensagem = "Organizacoes cadastradas.";
    } else if (comando.grupo === "contrato" && comando.acao === "criar") {
      const dataFim = opcaoOpcional(opcoes, "fim");
      resultado = await this.api.request("/contratos", {
        method: "POST",
        body: {
          organizacaoId: await this.opcaoOuPerguntar(opcoes, "org", "ID da organizacao: "),
          codigo: await this.opcaoOuPerguntar(opcoes, "codigo", "Codigo do contrato: "),
          dataInicio: await this.opcaoOuPerguntar(opcoes, "inicio", "Data inicial (AAAA-MM-DD): "),
          ...(dataFim ? { dataFim } : {}),
        },
      });
      mensagem = "Contrato criado.";
    } else if (comando.grupo === "contrato" && comando.acao === "listar") {
      const organizacaoId = opcaoOpcional(opcoes, "org");
      resultado = await this.api.request(`/contratos${organizacaoId ? `?organizacaoId=${encodeURIComponent(organizacaoId)}` : ""}`);
      mensagem = "Contratos cadastrados.";
    } else if (comando.grupo === "lote" && comando.acao === "criar") {
      resultado = await this.api.request("/lotes", {
        method: "POST",
        body: {
          organizacaoId: await this.opcaoOuPerguntar(opcoes, "org", "ID da organizacao: "),
          contratoId: await this.opcaoOuPerguntar(opcoes, "contrato", "ID do contrato: "),
          numeroNotaFiscal: await this.opcaoOuPerguntar(opcoes, "nf", "Numero da nota fiscal: "),
          transportadora: await this.opcaoOuPerguntar(opcoes, "transp", "Transportadora: "),
          dataEntrada: await this.opcaoOuPerguntar(opcoes, "data", "Data de entrada (AAAA-MM-DD): "),
        },
      });
      mensagem = "Lote registrado.";
    } else if (comando.grupo === "lote" && comando.acao === "listar") {
      resultado = await this.api.request("/lotes");
      mensagem = "Lotes cadastrados.";
    } else if (comando.grupo === "equip" && comando.acao === "criar") {
      resultado = await this.api.request("/equipamentos", {
        method: "POST",
        body: {
          loteId: await this.opcaoOuPerguntar(opcoes, "lote", "ID do lote: "),
          codigoBarras: await this.opcaoOuPerguntar(opcoes, "codigo", "Codigo de barras: "),
          tipo: converterEnum(await this.opcaoOuPerguntar(opcoes, "tipo", `Tipo (${TIPOS.join(", ")}): `), TIPOS, "tipo"),
          estadoFisico: converterEnum(await this.opcaoOuPerguntar(opcoes, "estado", `Estado fisico (${ESTADOS.join(", ")}): `), ESTADOS, "estado"),
        },
      });
      mensagem = "Equipamento cadastrado.";
    } else if (comando.grupo === "equip" && comando.acao === "listar") {
      resultado = await this.api.request("/equipamentos");
      mensagem = "Equipamentos cadastrados.";
    } else if (comando.grupo === "equip" && comando.acao === "triagem-iniciar") {
      const id = await this.opcaoOuPerguntar(opcoes, "id", "ID do equipamento: ");
      const equipamento = await this.buscarEquipamento(id);
      if (equipamento.status !== "RECEBIDO") throw new Error("A triagem so pode ser iniciada em equipamentos no status RECEBIDO.");
      resultado = await this.movimentar(equipamento, "EM_TRIAGEM", equipamento.estadoFisico);
      mensagem = "Triagem iniciada.";
    } else if (comando.grupo === "equip" && comando.acao === "triagem-concluir") {
      const id = await this.opcaoOuPerguntar(opcoes, "id", "ID do equipamento: ");
      const destino = converterEnum(
        await this.opcaoOuPerguntar(opcoes, "destino", "Destino (APTO_REUSO ou APTO_RECICLAGEM): "),
        ["APTO_REUSO", "APTO_RECICLAGEM"] as const,
        "destino",
      );
      const diagnostico = await this.opcaoOuPerguntar(opcoes, "diagnostico", "Diagnostico da triagem: ");
      if (diagnostico.length < 5) throw new Error("O diagnostico precisa conter pelo menos cinco caracteres.");
      let equipamento = await this.buscarEquipamento(id);
      if (equipamento.status === "RECEBIDO") {
        equipamento = await this.movimentar(equipamento, "EM_TRIAGEM", equipamento.estadoFisico);
      } else if (equipamento.status !== "EM_TRIAGEM") {
        throw new Error("A triagem so pode ser concluida em equipamentos RECEBIDO ou EM_TRIAGEM.");
      }
      resultado = await this.movimentar(equipamento, destino, equipamento.estadoFisico, {
        triagemCompleta: true,
        observacao: diagnostico,
      });
      mensagem = "Triagem concluida.";
    } else if (comando.grupo === "equip" && comando.acao === "movimentar") {
      const id = await this.opcaoOuPerguntar(opcoes, "id", "ID do equipamento: ");
      const status = converterEnum(await this.opcaoOuPerguntar(opcoes, "status", `Novo status (${STATUS.join(", ")}): `), STATUS, "status");
      const estadoFisico = converterEnum(await this.opcaoOuPerguntar(opcoes, "estado", `Novo estado fisico (${ESTADOS.join(", ")}): `), ESTADOS, "estado");
      const equipamento = await this.buscarEquipamento(id);
      resultado = await this.movimentar(equipamento, status, estadoFisico, {
        justificativa: opcaoOpcional(opcoes, "justificativa"),
      });
      mensagem = "Movimentacao registrada.";
    } else if (comando.grupo === "relatorio" && comando.acao === "rastrear") {
      const codigo = await this.opcaoOuPerguntar(opcoes, "codigo", "Codigo de barras do equipamento: ");
      resultado = await this.api.request(`/equipamentos/${encodeURIComponent(codigo)}/rastreabilidade`);
      mensagem = "Relatorio de rastreabilidade.";
    } else {
      throw new Error("Comando desconhecido. Use 'ajuda' para ver as opcoes disponiveis.");
    }

    console.log(`[SUCESSO] ${mensagem}`);
    if (resultado !== undefined) console.log(JSON.stringify(resultado, null, 2));
    return true;
  }

  private async buscarEquipamento(id: string): Promise<Equipamento> {
    const equipamentos = await this.api.request<Equipamento[]>("/equipamentos");
    const equipamento = equipamentos.find(item => item.id === id);
    if (!equipamento) throw new Error("Equipamento nao encontrado.");
    return equipamento;
  }

  private movimentar(
    equipamento: Equipamento,
    status: StatusRastreamento,
    estadoFisico: EstadoFisico,
    adicionais: { triagemCompleta?: boolean; justificativa?: string; observacao?: string } = {},
  ): Promise<Equipamento> {
    return this.api.request(`/equipamentos/${encodeURIComponent(equipamento.id)}/movimentacoes`, {
      method: "PATCH",
      body: { status, estadoFisico, versao: equipamento.versao, ...adicionais },
    });
  }

  private async opcaoOuPerguntar(opcoes: Record<string, string | true>, chave: string, texto: string): Promise<string> {
    const valor = opcoes[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    while (true) {
      const resposta = await this.perguntar(texto);
      if (resposta.trim()) return resposta.trim();
      console.error("[ERRO] Este campo e obrigatorio. Informe um valor para continuar.");
    }
  }

  private async perguntar(texto: string): Promise<string> {
    if (!this.terminal) throw new Error("A interface do terminal esta indisponivel.");
    return new Promise(resolve => this.terminal!.question(texto, resolve));
  }

  private async perguntarSenha(texto: string): Promise<string> {
    const terminalAnterior = this.terminal;
    const comandos = [...COMANDOS_POR_PAPEL[this.usuario.papel], "ajuda", "sair"];
    const historico = terminalAnterior?.history ?? [];
    terminalAnterior?.close();
    this.terminal = undefined;
    try {
      return await perguntarSenha(texto);
    } finally {
      this.terminal = this.criarTerminal(comandos);
      this.terminal.history = historico;
    }
  }

  private criarTerminal(comandos: string[]): Interface & { history: string[] } {
    return createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (linha: string) => {
        const prefixo = linha.trimStart();
        return [comandos.filter(comando => comando.startsWith(prefixo)), prefixo];
      },
      historySize: 500,
      removeHistoryDuplicates: true,
    }) as ReturnType<typeof createInterface> & { history: string[] };
  }
}

function opcaoOpcional(opcoes: Record<string, string | true>, chave: string): string | undefined {
  const valor = opcoes[chave];
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function converterEnum<const T extends readonly string[]>(valorInformado: string, valores: T, chave: string): T[number] {
  const encontrado = valores.find(item => item.toUpperCase() === valorInformado.toUpperCase());
  if (!encontrado) throw new Error(`Valor invalido para ${chave}. Opcoes: ${valores.join(", ")}`);
  return encontrado;
}

function parseNumero(valor: string, campo: string): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new Error(`Informe um numero valido para ${campo}.`);
  return numero;
}
