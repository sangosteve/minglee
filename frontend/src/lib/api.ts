// frontend/src/lib/api.ts
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken, refreshToken, clearAuth, setAuth } = useAuthStore.getState();
    
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

    // Handle token refresh on 401
    if (response.status === 401 && refreshToken && endpoint !== '/auth/refresh') {
      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          
          if (data.success) {
            setAuth(useAuthStore.getState().user!, {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            });

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${data.accessToken}`;
            const retryResponse = await fetch(`${API_URL}${endpoint}`, {
              ...options,
              headers,
              credentials: 'include',
            });
            
            return this.handleResponse<T>(retryResponse);
          }
        }
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
        refreshToken: string;
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
        refreshToken: string;
      }>('/auth/register', data),

    logout: () =>
      this.post<{ success: boolean; message: string }>('/auth/logout'),

    me: () =>
      this.get<{ success: boolean; user: any }>('/auth/me'),

    refresh: (refreshToken: string) =>
      this.post<{
        success: boolean;
        accessToken: string;
        refreshToken: string;
      }>('/auth/refresh', { refreshToken }),

    google: (accessToken: string) =>
      this.post<{
        success: boolean;
        user: any;
        accessToken: string;
        refreshToken: string;
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