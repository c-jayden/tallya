export function createFriendlyError(message: string, cause: unknown) {
  const error = new Error(message) as Error & { cause?: unknown };

  error.cause = cause;

  return error;
}
