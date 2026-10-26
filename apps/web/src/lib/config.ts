import path from "node:path";

export const config = {
  aiServiceUrl: (process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, ""),
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/$/, ""),
  demoMode: process.env.DEMO_MODE === "true",
  storageDir: process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"),
};

/** QR'a yazılacak kök adres: PUBLIC_BASE_URL, yoksa isteğin geldiği host. */
export function baseUrlFrom(headers: Headers): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
