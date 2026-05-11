const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const config: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        ...this.getAuthHeaders(),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    };

    if (body) {
      config.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  }

  // Auth
  login(emailOrUsername: string, password: string) {
    return this.request('/api/auth/login', { method: 'POST', body: { emailOrUsername, password } });
  }

  register(email: string, username: string, password: string) {
    return this.request('/api/auth/register', { method: 'POST', body: { email, username, password } });
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request('/api/auth/me');
  }

  refreshToken() {
    return this.request('/api/auth/refresh', { method: 'POST' });
  }

  forgotPassword(email: string) {
    return this.request('/api/auth/forgot-password', { method: 'POST', body: { email } });
  }

  resetPassword(token: string, password: string) {
    return this.request('/api/auth/reset-password', { method: 'POST', body: { token, password } });
  }

  // Practice
  getQuotes(difficulty?: number, limit = 1) {
    const params = new URLSearchParams();
    if (difficulty) params.set('difficulty', String(difficulty));
    params.set('limit', String(limit));
    return this.request(`/api/practice/quotes?${params}`);
  }

  submitPracticeResult(data: any) {
    return this.request('/api/practice/results', { method: 'POST', body: data });
  }

  getPracticeHistory(page = 1, limit = 20) {
    return this.request(`/api/practice/history?page=${page}&limit=${limit}`);
  }

  getPracticeStats() {
    return this.request('/api/practice/stats');
  }

  getLeaderboard(period = 'weekly', limit = 15) {
    return this.request(`/api/practice/leaderboard?period=${period}&limit=${limit}`);
  }

  // Tournaments
  getTournaments(status?: string, limit = 10) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    return this.request(`/api/tournaments?${params}`);
  }

  getTournament(id: string) {
    return this.request(`/api/tournaments/${id}`);
  }

  registerForTournament(id: string) {
    return this.request(`/api/tournaments/${id}/register`, { method: 'POST' });
  }

  submitTournamentResult(id: string, data: any) {
    return this.request(`/api/tournaments/${id}/submit-result`, { method: 'POST', body: data });
  }

  // Gamification
  checkAchievements() {
    return this.request('/api/gamification/check-achievements', { method: 'POST' });
  }

  getAchievements() {
    return this.request('/api/gamification/achievements');
  }

  getDailyChallenge() {
    return this.request('/api/gamification/daily-challenge');
  }

  checkDailyChallenge() {
    return this.request('/api/gamification/daily-challenge/check', { method: 'POST' });
  }

  getXPHistory() {
    return this.request('/api/gamification/xp-history');
  }

  updateStreak() {
    return this.request('/api/gamification/update-streak', { method: 'POST' });
  }

  // Payments
  submitPayment(formData: FormData) {
    return this.request('/api/payments/submit', { method: 'POST', body: formData });
  }

  getMyPayments() {
    return this.request('/api/payments/my');
  }

  // Admin
  getAdminDashboard() {
    return this.request('/api/admin/dashboard');
  }

  getAdminUsers(search = '', page = 1, limit = 20) {
    return this.request(`/api/admin/users?search=${search}&page=${page}&limit=${limit}`);
  }

  updateAdminUser(id: string, data: any) {
    return this.request(`/api/admin/users/${id}`, { method: 'PATCH', body: data });
  }

  getAntiCheatFlags(reviewed = false) {
    return this.request(`/api/admin/anti-cheat?reviewed=${reviewed}`);
  }

  reviewAntiCheatFlag(id: string, data: any) {
    return this.request(`/api/admin/anti-cheat/${id}`, { method: 'PATCH', body: data });
  }

  getPaymentQueue() {
    return this.request('/api/payments/admin/queue');
  }

  getPaymentHistory() {
    return this.request('/api/payments/admin/history');
  }

  verifyPayment(id: string, data: any) {
    return this.request(`/api/payments/admin/${id}/verify`, { method: 'PATCH', body: data });
  }
}

export const api = new ApiClient(API_BASE);
export { API_BASE };
