const fallbackErrorMessage =
  "Une erreur serveur est survenue. Réessaie dans un instant.";

function normaliseErrorMessage(message: string): string {
  const trimmed = message.trim();

  // Ne jamais afficher le HTML complet d'une page d'erreur dans une notification.
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return fallbackErrorMessage;
  }

  return trimmed || fallbackErrorMessage;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return normaliseErrorMessage(error.message);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return normaliseErrorMessage((error as { message: string }).message);
  }

  return fallbackErrorMessage;
}

export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = 10_000,
  label = "Opération Supabase",
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${label} a expiré après ${Math.round(timeoutMs / 1000)} secondes.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
