export function joinDataUrl(baseUrl: string, year: number, path = ''): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const safePath = path.replace(/^\/+/, '');
  return `${base}data/${year}/${safePath}`;
}

