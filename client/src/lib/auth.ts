export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
}

export function setAuth(accessToken: string, user: any) {
  localStorage.setItem('token', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'ADMIN';
}

export function requireAuth(): boolean {
  if (!isLoggedIn()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

export function handleLogout() {
  clearAuth();
  window.location.href = '/';
}
