export function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      response?: { data?: { detail?: unknown } };
      message?: unknown;
    };

    if (typeof err.response?.data?.detail === 'string' && err.response.data.detail.trim()) {
      return err.response.data.detail;
    }

    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
  }

  return fallback;
}
