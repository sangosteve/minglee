import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear authentication token
    localStorage.removeItem("auth_token");
    // Clear any other auth-related storage
    // sessionStorage.removeItem("user");
    
    // Redirect to login after a short delay
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-12 w-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Logging out...</h1>
        <p className="text-muted-foreground">Redirecting to login page</p>
      </div>
    </div>
  );
}