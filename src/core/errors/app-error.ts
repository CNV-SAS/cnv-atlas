// Error esperable de la app. Las server actions lo retornan dentro de Result en
// vez de hacer throw (ARCHITECTURE). El message va en espanol, apto para la UI;
// fields lleva errores por campo (ej. Zod) sin datos sensibles.
export type AppErrorCode =
  | "unauthorized" // sin sesion
  | "forbidden" // sesion sin permiso (policy)
  | "invalid_credentials"
  | "mfa_required"
  | "validation"
  | "not_found"
  | "conflict"
  | "stale_write" // escritura sobre un estado que cambio desde que se leyo (optimistic concurrency)
  | "rate_limited"
  | "internal";

export type AppError = {
  code: AppErrorCode;
  message: string;
  fields?: Record<string, string>;
};

export function appError(
  code: AppErrorCode,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return fields ? { code, message, fields } : { code, message };
}
