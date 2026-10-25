export class AppError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

export const badRequest = (message: string) => new AppError(message, 400);
export const unauthorized = (message = "Nao autenticado.") => new AppError(message, 401);
export const forbidden = (message = "Acesso negado para este papel.") => new AppError(message, 403);
export const notFound = (message = "Registro nao encontrado.") => new AppError(message, 404);
export const conflict = (message: string) => new AppError(message, 409);
