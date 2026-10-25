import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Variavel de ambiente obrigatoria: ${name}`);
  return value;
}

export const env = {
  port: Number(required("PORT", "3333")),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: required("JWT_EXPIRES_IN", "1h"),
};

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error("PORT invalida.");
if (env.jwtSecret.length < 32) throw new Error("JWT_SECRET deve conter ao menos 32 caracteres.");
