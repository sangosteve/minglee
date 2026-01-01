// frontend/src/pages/auth/Signup.tsx
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { SocialAuthSeparator } from "@/components/auth/SocialAuthSeparator";
import { api } from "@/lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading, accessToken } = useAuthStore();
  
  // Get invitation data from location state
  const invitationToken = location.state?.invitationToken;
  const invitationEmail = location.state?.email;
  const returnTo = location.state?.returnTo || "/";

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  // Pre-fill email if provided in invitation
  useEffect(() => {
    if (invitationEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: invitationEmail }));
    }
  }, [invitationEmail]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    // Check if phone is accidentally the same as email
    if (formData.phone === formData.email) {
      toast.error("Please enter a valid phone number, not your email");
      return;
    }
    
    try {
      // Register the user
      const userData = await register({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone || undefined,
      });
      
      console.log('✅ Registration successful, user data:', userData);
      
      toast.success("Account created successfully!");
      
      // After successful registration, check for invitation token
      if (invitationToken && accessToken) {
        console.log('📧 Attempting to accept invitation after signup...');
        console.log('📧 Token:', invitationToken);
        console.log('📧 Auth token available:', !!accessToken);
        
        // Wait a moment for auth state to be fully updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await handleInvitationAcceptance();
      } else if (invitationToken) {
        console.warn('⚠️ No access token available after signup, cannot accept invitation');
        toast.info('Account created! Please log in to accept the invitation.');
        navigate('/login', { 
          state: { 
            email: formData.email,
            invitationToken,
            returnTo 
          } 
        });
      } else {
        // Normal signup flow
        navigate(returnTo);
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('already exists')) {
        toast.error("Email already registered", {
          description: "This email is already associated with an account. Please log in instead.",
          action: {
            label: "Log In",
            onClick: () => navigate('/login', { 
              state: { 
                email: formData.email,
                invitationToken,
                returnTo 
              } 
            }),
          },
        });
      } else {
        toast.error(error.message || "Registration failed");
      }
    }
  };

  const handleInvitationAcceptance = async () => {
    if (!invitationToken || !accessToken) {
      console.error('Missing token or access token');
      return;
    }
    
    try {
      console.log('🤝 Calling acceptInvitation API...');
      
      // Use a direct fetch to ensure we have the latest auth token
      const response = await fetch(`http://localhost:5000/api/teams/invitation/${invitationToken}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
      });
      
      console.log('📊 API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        
        let errorMessage = 'Failed to accept invitation';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('✅ Invitation acceptance data:', data);
      
      if (data.success) {
        toast.success('Invitation accepted!', {
          description: `You've joined ${data.team.name} as a ${data.role}`,
        });
        
        // Navigate to the team page
        setTimeout(() => {
          navigate(`/teams/${data.team.id}`);
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to accept invitation:', error);
      
      // Don't fail the entire signup process if invitation fails
      toast.info('Account created!', {
        description: error.message || 'You can accept the invitation later from your Teams page.',
      });
      
      // Still navigate to returnTo or home
      navigate(returnTo);
    }
  };

  const handleGoogleSuccess = (userData: any) => {
    console.log("✅ Google signup successful!", userData);
    
    // After Google signup, check for invitation token
    if (invitationToken && accessToken) {
      setTimeout(() => {
        handleInvitationAcceptance();
      }, 1000);
    } else if (invitationToken) {
      toast.info('Google signup successful! Please refresh to accept the invitation.');
      navigate(returnTo);
    } else {
      navigate(returnTo);
    }
  };

  const handleGoogleError = (error: any) => {
    console.error("❌ Google signup error:", error);
    toast.error(error.message || "Google signup failed");
  };

  return (
    <AuthLayout 
      title="Create an account" 
      subtitle={
        invitationToken 
          ? "Create your account to accept the team invitation" 
          : "Enter your details to get started"
      }
    >
      {invitationToken && (
        <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-primary">
            <span className="font-semibold">Team Invitation:</span> You're signing up to accept a team invitation.
            {invitationEmail && ` Your invited email is ${invitationEmail}`}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="John"
                required
                value={formData.firstName}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Doe"
                required
                value={formData.lastName}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              autoComplete="email"
              readOnly={!!invitationEmail}
              className={invitationEmail ? "bg-muted" : ""}
            />
            {invitationEmail && (
              <p className="text-xs text-muted-foreground">
                This email is from your invitation. You cannot change it.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+1234567890"
              value={formData.phone}
              onChange={handleChange}
              disabled={isLoading}
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              Enter your phone number, not your email
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading 
            ? "Creating account..." 
            : invitationToken 
              ? "Create Account & Accept Invitation" 
              : "Create account"
          }
        </Button>

        <SocialAuthSeparator />

        <GoogleAuthButton 
          text={invitationToken ? "Sign up with Google & Accept Invitation" : "Sign up with Google"}
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
        />

        <div className="text-center text-sm">
          Already have an account?{" "}
          <Link 
            to="/login" 
            className="text-primary font-medium hover:underline"
            state={{
              email: invitationEmail || formData.email,
              invitationToken,
              returnTo
            }}
          >
            Sign in
          </Link>
        </div>

        {invitationToken && (
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>
              By creating an account, you'll automatically accept the team invitation.
              You can manage your team memberships in the Teams section.
            </p>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}