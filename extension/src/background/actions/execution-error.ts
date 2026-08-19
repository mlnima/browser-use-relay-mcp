export const executionError = (message: string, fallbackSafe = false) => Object.assign(new Error(message), { fallbackSafe });

export const isFallbackSafeError = (error: unknown) => error instanceof Error &&
  (error as Error & { fallbackSafe?: boolean }).fallbackSafe === true;
