/** Τύποι σφαλμάτων του API — χωρίς εξαρτήσεις από το Next runtime. */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'AI_UNAVAILABLE'
  | 'NO_FOOD_DETECTED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  AI_UNAVAILABLE: 502,
  NO_FOOD_DETECTED: 422,
  SUBSCRIPTION_REQUIRED: 402,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

/** Σφάλμα με ασφαλές, προβλέψιμο μήνυμα προς τον client. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}
