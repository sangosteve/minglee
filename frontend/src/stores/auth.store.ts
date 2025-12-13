// frontend/src/stores/auth.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  isAdmin: boolean;
  isActive: boolean;
  whatsappBusinessId?: string;
  whatsappPhoneNumberId?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setAuth: (user: User, tokens: { accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  googleLogin: (accessToken: string) => Promise<void>;
  initializeAuth: () => Promise<void>;
  setInitialized: (initialized: boolean) => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      setLoading: (loading) => set({ isLoading: loading }),
      
      setInitialized: (initialized) => set({ isInitialized: initialized }),

      setAuth: (user, tokens) => {
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      initializeAuth: async () => {
        const { accessToken, refreshToken, user } = get();
        
        // If no tokens stored, mark as initialized
        if (!accessToken || !refreshToken || !user) {
          set({ isInitialized: true });
          return;
        }
        
        set({ isLoading: true });
        
        try {
          // Validate token with backend
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (response.ok) {
            // Token is valid
            set({ 
              isAuthenticated: true,
              isInitialized: true,
            });
          } else {
            // Token invalid, try to refresh
            try {
              await get().refreshToken();
              set({ isInitialized: true });
            } catch (refreshError) {
              // Refresh failed, clear auth
              get().clearAuth();
              set({ isInitialized: true });
            }
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          get().clearAuth();
          set({ isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Login failed');
          }

          get().setAuth(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } catch (error: any) {
          console.error('Login error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Registration failed');
          }

          get().setAuth(result.user, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
        } catch (error: any) {
          console.error('Registration error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      googleLogin: async (accessToken: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/google/frontend`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accessToken }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Google login failed');
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Google login failed');
          }

          get().setAuth(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } catch (error: any) {
          console.error('Google login error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        
        try {
          if (refreshToken) {
            await fetch(`${API_URL}/auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get().accessToken}`,
              },
              body: JSON.stringify({ refreshToken }),
            });
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          get().clearAuth();
        }
      },

      refreshToken: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error('Token refresh failed');
          }

          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });

          return data.accessToken;
        } catch (error) {
          get().clearAuth();
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      version: 1,
    }
  )
);