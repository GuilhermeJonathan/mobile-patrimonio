export interface JwtPayload {
  nameid?: string;
  unique_name?: string;
  email?: string;
  userType?: string;
  exp?: number;
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < b64.length) {
    const a = chars.indexOf(b64[i++]);
    const b = chars.indexOf(b64[i++]);
    const c = chars.indexOf(b64[i++]);
    const d = chars.indexOf(b64[i++]);
    if (a < 0 || b < 0) break;
    result += String.fromCharCode((a << 2) | (b >> 4));
    if (c >= 0) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d >= 0) result += String.fromCharCode(((c & 3) << 6) | d);
  }
  try {
    return decodeURIComponent(result.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch { return result; }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch { return null; }
}

export function tokenExpiresAt(token: string): Date | null {
  const p = decodeToken(token);
  return p?.exp ? new Date(p.exp * 1000) : null;
}

export function timeUntilExpiry(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `expira em ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `expira em ${hrs}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`;
}
