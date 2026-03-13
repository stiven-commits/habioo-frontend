interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export const PROD_API_BASE_URL: string = 'https://auth.habioo.cloud';

const configuredBaseUrl: string = (import.meta.env.VITE_API_BASE_URL || '').trim();
const isLocalHost: boolean =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL: string = configuredBaseUrl || (isLocalHost ? 'http://localhost:3000' : PROD_API_BASE_URL);
