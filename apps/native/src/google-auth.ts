const ERROR_MESSAGES: Record<string, string> = {
  google_unavailable: 'Google sign-in is temporarily unavailable.',
  google_failed: 'Google sign-in could not be completed. Please try again.',
  access_denied: 'Google sign-in was cancelled.',
};

export interface GoogleAuthCallback {
  token: string | null;
  error: string | null;
}

export function parseGoogleAuthCallback(value: string): GoogleAuthCallback {
  try {
    const url = new URL(value);
    if (url.protocol !== 'nutreluma:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
      return { token: null, error: null };
    }

    const token = url.searchParams.get('token');
    const errorCode = url.searchParams.get('error');
    return {
      token: token || null,
      error: errorCode ? ERROR_MESSAGES[errorCode] ?? 'Google sign-in could not be completed.' : null,
    };
  } catch {
    return { token: null, error: null };
  }
}
