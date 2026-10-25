import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { registerControllers } from "./modules/domain/controller.js";

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1_048_576 });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(swagger, { openapi: { info: { title: "GreenCode API", description: "API REST de rastreabilidade de equipamentos eletronicos.", version: "1.0.0" }, components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } }, security: [{ bearerAuth: [] }] } });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  app.get("/health", { config: { public: true }, schema: { tags: ["sistema"], response: { 200: { type: "object", properties: { status: { type: "string" } }, required: ["status"] } } } }, async () => ({ status: "ok" }));
  await registerControllers(app);
  return app;
}

export { env };
