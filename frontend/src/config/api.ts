// Centralized API configuration for CIVORA AI
// In development: defaults to http://127.0.0.1:8000
// In production (e.g. Vercel): configured via VITE_API_URL environment variable

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

