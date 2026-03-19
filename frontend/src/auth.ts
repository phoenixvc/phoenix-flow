const TOKEN_KEY = 'mystira_jwt';

export interface MystiraClaims {
  sub: string;
  account_id?: string;
  email?: string;
  name?: string;
  role?: string;
  exp?: number;
}

function parseJwt(token: string): MystiraClaims | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getClaims(): MystiraClaims | null {
  const token = getToken();
  return token ? parseJwt(token) : null;
}

export function isAuthenticated(): boolean {
  const claims = getClaims();
  if (!claims) return false;
  // Check expiry with 10s clock skew buffer
  if (claims.exp && Date.now() / 1000 > claims.exp - 10) {
    clearToken();
    return false;
  }
  return true;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logout(): void {
  clearToken();
  window.location.href = '/';
}
