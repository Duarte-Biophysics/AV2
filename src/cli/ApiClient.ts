interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  authenticated?: boolean;
}

export class ApiClient {
  private token?: string;

  constructor(private readonly baseUrl: string) {}

  setToken(token: string): void {
    this.token = token;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (options.authenticated !== false && this.token) headers.set("authorization", `Bearer ${this.token}`);

    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), {
        method: options.method ?? "GET",
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "falha de rede";
      throw new Error(`Nao foi possivel conectar a API em ${this.baseUrl}. Confira se o servidor esta em execucao. (${detail})`);
    }

    const text = await response.text();
    let payload: unknown;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `A API respondeu com HTTP ${response.status}.`;
      throw new Error(message);
    }
    return payload as T;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
