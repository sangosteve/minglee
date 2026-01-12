// frontend/src/components/auth/GoogleAuthButton.tsx
import { Button } from "@/components/ui/button";
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from "@/stores/auth.store";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface GoogleAuthButtonProps {
  text?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export function GoogleAuthButton({ 
  text = "Continue with Google",
  variant = "outline",
  className = "",
  onSuccess,
  onError
}: GoogleAuthButtonProps) {
  const { googleLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Google OAuth success:', tokenResponse);
      try {
        await googleLogin(tokenResponse.access_token);
        toast.success("Successfully authenticated with Google!");
        navigate("/dashboard", { replace: true }); // Fixed: redirect to dashboard
        onSuccess?.();
      } catch (error: any) {
        console.error('Google auth error:', error);
        toast.error(error.message || "Authentication failed");
        onError?.(error);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      toast.error("Google authentication failed");
      onError?.(error);
    },
    flow: 'implicit',
  });

  return (
    <Button
      variant={variant}
      className={`w-full ${className}`}
      onClick={() => login()}
      disabled={isLoading}
      type="button"
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {isLoading ? "Connecting..." : text}
    </Button>
  );
}