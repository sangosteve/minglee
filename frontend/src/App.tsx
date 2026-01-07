// frontend/src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Conversations from "./pages/Conversations";
import Contacts from "./pages/Contacts";
import Analytics from "./pages/Analytics";
import Broadcasts from "./pages/Broadcasts";
import Campaigns from "./pages/Campaigns";
import Automations from "./pages/automations/Automations";
import Teams from "./pages/Teams";
import Tags from "./pages/Tags";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Logout from "./pages/auth/Logout";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthInterceptor } from "./components/auth/AuthInterceptor";
import { TagsProvider } from "./components/tags/TagsProvider";
import Settings from "./pages/Settings";
// Add these imports to your existing imports:
import AutomationBuilder from "./pages/automations/AutomationBuilder";
import AutomationEditor from "./pages/automations/AutomationEditor";
import { TeamInvitationPage } from "./pages/TeamInvitationPage";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  
  // Show loading while checking auth
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  
  // Show loading while checking auth
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to home if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppContent = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/signup" element={
        <PublicRoute>
          <Signup />
        </PublicRoute>
      } />
      <Route path="/forgot-password" element={
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      } />
      <Route path="/logout" element={<Logout />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />

        <Route path="/dashboard" element={
        <ProtectedRoute>
          <MainLayout title="Dashboard">
            <Dashboard/>
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/conversations" element={
        <ProtectedRoute>
          <MainLayout title="Conversations" subtitle="Manage all your conversations">
            <Conversations />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/contacts" element={
        <ProtectedRoute>
          <MainLayout title="Contacts" subtitle="Manage your contact list">
            <Contacts />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute>
          <MainLayout title="Analytics" subtitle="View insights and reports">
            <Analytics />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/broadcasts" element={
        <ProtectedRoute>
          <MainLayout title="Broadcasts" subtitle="Send messages to your audience">
            <Broadcasts />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/campaigns" element={
        <ProtectedRoute>
          <MainLayout title="Campaigns" subtitle="Create and manage campaigns">
            <Campaigns />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/automations" element={
        <ProtectedRoute>
          <MainLayout title="Automations" subtitle="Set up automated workflows">
            <Automations />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* NEW AUTOMATION ROUTES */}
      <Route path="/automations/new" element={
        <ProtectedRoute>
          <AutomationBuilder />
        </ProtectedRoute>
      } />
      
      <Route path="/automations/:id/edit" element={
        <ProtectedRoute>
          <AutomationEditor />
        </ProtectedRoute>
      } />
      
      <Route path="/teams" element={
        <ProtectedRoute>
          <MainLayout title="Teams" subtitle="Manage team members and roles">
            <Teams />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/teams/invitation/:token" element={<TeamInvitationPage />} />
      
      <Route path="/tags" element={
        <ProtectedRoute>
          <MainLayout title="Tags" subtitle="Organize with tags and labels">
            <Tags />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <MainLayout title="Settings" subtitle="Organize with tags and labels">
            <Settings />
          </MainLayout>
        </ProtectedRoute>
      } />

      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  const { initializeAuth, isInitialized } = useAuthStore();
  const [isAppReady, setIsAppReady] = useState(false);

  // Initialize auth state on app load
  useEffect(() => {
    const initApp = async () => {
      // Initialize auth (checks stored tokens)
      await initializeAuth();
      setIsAppReady(true);
    };

    initApp();
  }, [initializeAuth]);

  // Show loading screen while initializing
  if (!isAppReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-muted-foreground">Initializing application</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <BrowserRouter>
            <AuthInterceptor>
               <TagsProvider>
              <AppContent />
              </TagsProvider>
            </AuthInterceptor>
          </BrowserRouter>
        </GoogleOAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;