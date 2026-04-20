const LOCAL_BACKEND_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function normalizeBackendUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (LOCAL_BACKEND_HOSTS.has(url.hostname)) {
      url.protocol = "http:";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}
