// CrimeSphere AI — Axios Client
// Talks to the AWS backend (API Gateway + Lambda). See backend/README.md.

import axios from 'axios';
import { API_URL } from './config';
import { session } from './session';

export const axiosClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor — attach the Cognito ID token
axiosClient.interceptors.request.use(
  (config) => {
    const token = session.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — an expired/invalid token signs the officer out.
// (Only when we actually had a token, so a wrong PIN at login isn't treated as a session expiry.)
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && session.getToken()) {
      session.setToken(null);
      session.handleUnauthorized();
    }
    return Promise.reject(error);
  }
);
