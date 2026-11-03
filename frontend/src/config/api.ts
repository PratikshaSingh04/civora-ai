// Centralized API configuration for CIVORA AI
// In development: defaults to http://127.0.0.1:8000
// In production (e.g. Vercel / Render): configured via VITE_API_URL or relative path

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
    : import.meta.env.PROD
    ? ""
    : "http://127.0.0.1:8000";
