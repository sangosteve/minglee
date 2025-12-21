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
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setAuth: (user: User, tokens: { accessToken: string }) => void;
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
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      setLoading: (loading) => set({ isLoading: loading }),
      
      setInitialized: (initialized) => set({ isInitialized: initialized }),

      setAuth: (user, tokens) => {
        set({
          user,
          accessToken: tokens.accessToken,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      initializeAuth: async () => {
        const { accessToken, user } = get();

        // If there's no access token or user, try a silent refresh (server cookie)
        if (!accessToken || !user) {
          set({ isLoading: true });
          try {
            await get().refreshToken();
          } catch (refreshError) {
            // Refresh failed, clear auth
            get().clearAuth();
          } finally {
            set({ isInitialized: true, isLoading: false });
          }

          return;
        }

        // If we already have an access token and user, validate it
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (response.ok) {
            set({ isAuthenticated: true, isInitialized: true });
          } else {
            try {
              await get().refreshToken();
            } catch (refreshError) {
              get().clearAuth();
            } finally {
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
            credentials: 'include',
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Login failed');
          }

          // Server sets refresh token in an httpOnly cookie; store only access token & user
          get().setAuth(data.user, {
            accessToken: data.accessToken,
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
            credentials: 'include',
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Registration failed');
          }

          // Server sets refresh token in httpOnly cookie; store only access token & user
          get().setAuth(result.user, { accessToken: result.accessToken });
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
            credentials: 'include',
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
          });
        } catch (error: any) {
          console.error('Google login error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          // Server will revoke refresh token from httpOnly cookie
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().accessToken}`,
            },
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          get().clearAuth();
        }
      },

      refreshToken: async () => {
        try {
          // Call refresh endpoint; server reads httpOnly cookie and returns a new access token and possibly user
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error('Token refresh failed');
          }

          // Update access token (server keeps refresh token in httpOnly cookie)
          set({ accessToken: data.accessToken, isAuthenticated: true });

          // If response included user, set it; otherwise fetch /auth/me
          if (data.user) {
            set({ user: data.user });
          } else {
            // Fetch user
            const meResp = await fetch(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${data.accessToken}` },
              credentials: 'include',
            });

            if (meResp.ok) {
              const meData = await meResp.json();
              if (meData.success && meData.user) {
                set({ user: meData.user });
              }
            }
          }

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
      }),
      version: 1,
    }
  )
);