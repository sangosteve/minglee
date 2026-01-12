// frontend/src/components/auth/AuthInterceptor.tsx
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate, useLocation } from 'react-router-dom';

export const AuthInterceptor = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, accessToken, initializeAuth, isInitialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Redirect logic based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const isPublicRoute = ['/login', '/signup', '/forgot-password'].includes(location.pathname);
    const isAuthRoute = location.pathname === '/logout' || isPublicRoute;

    if (isAuthenticated && isPublicRoute) {
      // If authenticated and trying to access login/signup, redirect to dashboard
      navigate('/dashboard', { replace: true });
    } else if (!isAuthenticated && !isAuthRoute && location.pathname !== '/teams/invitation') {
      // If not authenticated and trying to access protected route, redirect to login
      navigate('/login', { 
        replace: true,
        state: { from: location.pathname }
      });
    }
  }, [isAuthenticated, location.pathname, navigate, isInitialized]);

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
    if (isAuthenticated) {
      checkTokenExpiration();
    }

    // Set up interval to check every minute
    const interval = setInterval(checkTokenExpiration, 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, isAuthenticated, navigate, location]);

  // Listen for storage events (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-storage' && e.newValue) {
        const newState = JSON.parse(e.newValue);
        const { setAuth, clearAuth } = useAuthStore.getState();
        
        if (newState.state.user && newState.state.accessToken) {
          setAuth(newState.state.user, {
            accessToken: newState.state.accessToken,
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