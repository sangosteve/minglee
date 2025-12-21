// frontend/src/lib/api.ts
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private refreshPromise: Promise<void> | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken, clearAuth, setAuth } = useAuthStore.getState();
    
 const headers: HeadersInit = {};
  
    // Don't automatically set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Handle token refresh on 401 (use httpOnly cookie; single-refresh promise)
    if (response.status === 401 && endpoint !== '/auth/refresh') {
      try {
        // If a refresh is already in progress, wait for it. Otherwise, start one.
        if (!this.refreshPromise) {
          this.refreshPromise = (async () => {
            // Call refresh endpoint — it will use the httpOnly cookie
            const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });

            if (!refreshResponse.ok) throw new Error('Refresh failed');

            const refreshData = await refreshResponse.json();
            if (!refreshData.success) throw new Error('Refresh failed');

            // If the refresh endpoint returns the user and access token, use them
            if (refreshData.user && refreshData.accessToken) {
              setAuth(refreshData.user, { accessToken: refreshData.accessToken });
            } else if (refreshData.accessToken) {
              // Otherwise fetch user using the new access token
              const meResponse = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${refreshData.accessToken}` },
                credentials: 'include',
              });

              if (!meResponse.ok) throw new Error('Failed to fetch user after refresh');

              const meData = await meResponse.json();
              if (!meData.success || !meData.user) throw new Error('Failed to fetch user after refresh');

              setAuth(meData.user, { accessToken: refreshData.accessToken });
            } else {
              throw new Error('Refresh failed - no access token returned');
            }
          })().finally(() => {
            this.refreshPromise = null;
          });
        }

        // Wait for whichever refresh is in progress to finish
        await this.refreshPromise;

        // Retry original request with the latest access token
        const latestAccessToken = useAuthStore.getState().accessToken;
        if (!latestAccessToken) throw new Error('Session expired');

        headers['Authorization'] = `Bearer ${latestAccessToken}`;
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });

        return this.handleResponse<T>(retryResponse);
      } catch (error) {
        console.error('Token refresh failed:', error);
        clearAuth();
        throw new Error('Session expired. Please login again.');
      }
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    
    // Handle empty responses
    if (!text && response.ok) {
      return {} as T;
    }
    
    if (!text) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    try {
      const data = JSON.parse(text);
      
      if (!response.ok) {
        // If unauthorized and we've already tried refreshing, clear auth
        if (response.status === 401) {
          useAuthStore.getState().clearAuth();
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      throw new Error('Invalid JSON response');
    }
  }

  // Generic HTTP methods
  get = <T>(endpoint: string, params?: Record<string, any>): Promise<T> => {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  };
  
  post = <T>(endpoint: string, data?: any): Promise<T> => 
    this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  
  put = <T>(endpoint: string, data?: any): Promise<T> => 
    this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  
  patch = <T>(endpoint: string, data?: any): Promise<T> => 
    this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  
  delete = <T>(endpoint: string): Promise<T> => 
    this.request<T>(endpoint, {
      method: 'DELETE',
    });

  // Auth endpoints
  auth = {
    login: (email: string, password: string) =>
      this.post<{
        success: boolean;
        user: any;
        accessToken: string;
      }>('/auth/login', { email, password }),

    register: (data: {
      email: string;
      password: string;
      name: string;
      phone?: string;
    }) =>
      this.post<{
        success: boolean;
        user: any;
        accessToken: string;
      }>('/auth/register', data),

    logout: () =>
      this.post<{ success: boolean; message: string }>('/auth/logout'),

    me: () =>
      this.get<{ success: boolean; user: any }>('/auth/me'),

    refresh: () =>
      this.request<{
        success: boolean;
        accessToken: string;
        user?: any;
      }>('/auth/refresh', { method: 'POST' }),

    google: (accessToken: string) =>
      this.post<{
        success: boolean;
        user: any;
        accessToken: string;
      }>('/auth/google/frontend', { accessToken }),
  };

  // Contacts endpoints
  contacts = {
    getAll: (filters?: any) => {
      const queryString = filters ? `?${new URLSearchParams(filters).toString()}` : '';
      return this.get<any>(`/contacts${queryString}`);
    },
    getById: (id: string) => this.get<any>(`/contacts/${id}`),
    create: (data: any) => this.post<any>('/contacts', data),
    update: (id: string, data: any) => this.put<any>(`/contacts/${id}`, data),
    delete: (id: string) => this.delete<any>(`/contacts/${id}`),
  };
}

export const api = new ApiClient();