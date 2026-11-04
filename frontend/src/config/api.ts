// Centralized API configuration for CIVORA AI
// When VITE_API_URL is set (e.g. deployed on Vercel pointing to Render backend), use it.
// When running in production on a unified host (Render) or local development with Vite proxy, use "" (relative /api).
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
    : "";
