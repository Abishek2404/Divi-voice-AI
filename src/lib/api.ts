export const getApiUrl = (path: string) => {
  const baseUrl = (import.meta as any).env.VITE_BACKEND_URL || "";
  // Ensure we don't have double slashes if baseUrl ends with / and path starts with /
  const sanitizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${sanitizedBase}${sanitizedPath}`;
};

export const getWsUrl = (path: string) => {
  if ((import.meta as any).env.VITE_BACKEND_URL) {
    const baseUrl = (import.meta as any).env.VITE_BACKEND_URL;
    let wsBase = baseUrl.replace(/^http/, 'ws');
    const sanitizedBase = wsBase.endsWith("/") ? wsBase.slice(0, -1) : wsBase;
    const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${sanitizedBase}${sanitizedPath}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${protocol}//${host}${sanitizedPath}`;
};
