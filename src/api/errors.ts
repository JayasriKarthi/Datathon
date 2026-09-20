import axios from 'axios';

/** Turns an axios failure into a message that is safe to show an officer. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check your connection and try again.';
    const detail = err.response.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return `Invalid input: ${detail[0].msg}`;  // FastAPI validation
    if (err.response.status === 403) return 'Your role is not permitted to do this.';
  }
  return fallback;
}
