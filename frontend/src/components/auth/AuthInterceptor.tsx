// frontend/src/components/auth/AuthInterceptor.tsx
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate, useLocation } from 'react-router-dom';

export const AuthInterceptor = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, accessToken, refreshToken, initializeAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Check token expiration periodically
  useEffect(() => {
    const checkTokenExpiration = () => {
      if (!accessToken || !isAuthenticated) return;

      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // If token expires in less than 5 minutes, try to refresh
        if (expiresAt - now < fiveMinutes) {
          useAuthStore.getState().refreshToken().catch(() => {
            // If refresh fails, redirect to login
            if (location.pathname !== '/login') {
              navigate('/login', { 
                replace: true,
                state: { from: location.pathname }
              });
            }
          });
        }
      } catch (error) {
        console.error('Error checking token expiration:', error);
      }
    };

    // Check immediately
    checkTokenExpiration();

    // Set up interval to check every minute
    const interval = setInterval(checkTokenExpiration, 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, isAuthenticated, navigate, location]);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Listen for storage events (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-storage' && e.newValue) {
        const newState = JSON.parse(e.newValue);
        const { setAuth, clearAuth } = useAuthStore.getState();
        
        if (newState.state.user && newState.state.accessToken) {
          setAuth(newState.state.user, {
            accessToken: newState.state.accessToken,
            refreshToken: newState.state.refreshToken,
          });
        } else {
          clearAuth();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return <>{children}</>;
};