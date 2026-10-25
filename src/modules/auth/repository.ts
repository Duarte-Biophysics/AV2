import type { PrismaClient } from "@prisma/client";

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}
  findByLogin(login: string) { return this.db.usuario.findUnique({ where: { login } }); }
}
