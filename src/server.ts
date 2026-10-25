import { buildApp, env } from "./app.js";

const app = await buildApp();
let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "Encerrando servidor e conexoes.");
  try { await app.close(); process.exitCode = 0; }
  catch (error) { app.log.error(error, "Falha durante encerramento."); process.exitCode = 1; }
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try { await app.listen({ host: "0.0.0.0", port: env.port }); }
catch (error) { app.log.error(error); await app.close(); process.exitCode = 1; }
