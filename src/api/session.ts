// Holds the auth token outside React state so axiosClient can read it without
// importing the auth store (which would create a circular import).
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const session = {
  getToken: () => token,
  setToken: (t: string | null) => { token = t; },
  setUnauthorizedHandler: (fn: () => void) => { onUnauthorized = fn; },
  handleUnauthorized: () => { onUnauthorized?.(); },
};
