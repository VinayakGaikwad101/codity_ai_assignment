import axios from 'axios';

const isDev = typeof window !== 'undefined' && window.location.port === '3000';
const baseURL = isDev ? 'http://localhost:4000/api/v1' : '/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token or fallback token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorPayload = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Unable to connect to server',
    };
    return Promise.reject(errorPayload);
  }
);
