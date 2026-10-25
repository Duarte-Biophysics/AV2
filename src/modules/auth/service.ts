import type { FastifyInstance } from "fastify";
import { AuthRepository } from "./repository.js";
import { unauthorized } from "../../shared/errors.js";
import { verifyPassword } from "../../shared/password.js";

export class AuthService {
  private readonly repository: AuthRepository;
  constructor(private readonly app: FastifyInstance) { this.repository = new AuthRepository(app.prisma); }

  async login(login: string, senha: string) {
    const normalized = login.trim().toLowerCase();
    const user = await this.repository.findByLogin(normalized);
    if (!user?.ativo || !verifyPassword(user.senhaSalt, user.senhaHash, senha)) throw unauthorized("Login ou senha invalidos.");
    return { token: this.app.jwt.sign({ sub: user.id, papel: user.papel }), usuario: { id: user.id, login: user.login, nome: user.nome, papel: user.papel } };
  }
}
