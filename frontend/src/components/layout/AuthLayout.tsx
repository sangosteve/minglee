import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title = "Welcome back", subtitle = "Enter your credentials to access your account" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold">
            <div className="h-8 w-8 bg-primary rounded-lg" />
            <span>YourBrand</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-6">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>

        {/* Auth Form Container */}
        <div className="bg-card rounded-2xl shadow-lg border p-6 sm:p-8">
          {children}
        </div>

        {/* Footer Links */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            By continuing, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}