import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle forgot password logic here
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email to receive reset instructions">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
            />
            <p className="text-sm text-muted-foreground">
              We'll send you a link to reset your password
            </p>
          </div>
        </div>

        <Button type="submit" className="w-full">
          Send reset link
        </Button>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary font-medium hover:underline">
            ← Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}