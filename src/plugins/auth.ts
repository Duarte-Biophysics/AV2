import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { unauthorized } from "../shared/errors.js";

export interface JwtUser { sub: string; papel: "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR" }
declare module "@fastify/jwt" { interface FastifyJWT { user: JwtUser } }
declare module "fastify" { interface FastifyRequest { currentUser: JwtUser | null } }

async function registerAuth(app: FastifyInstance) {
  await app.register(jwt, { secret: env.jwtSecret, sign: { expiresIn: env.jwtExpiresIn } });
  app.decorateRequest("currentUser", null);
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const routeIsPublic = (request.routeOptions.config as { public?: boolean } | undefined)?.public === true;
    if (routeIsPublic || request.url.startsWith("/docs")) return;
    try { await request.jwtVerify(); request.currentUser = request.user; }
    catch { throw unauthorized("Token ausente, invalido ou expirado."); }
    const account = await app.prisma.usuario.findUnique({ where: { id: request.user.sub }, select: { ativo: true, papel: true } });
    if (!account?.ativo || account.papel !== request.user.papel) {
      request.currentUser = null;
      throw unauthorized("Token ausente, invalido ou expirado.");
    }
  });
}

export const authPlugin = fp(registerAuth);
