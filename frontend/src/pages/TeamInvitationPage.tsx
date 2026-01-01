// frontend/src/pages/TeamInvitationPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvitationByToken, useAcceptInvitation, useTeams } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  UsersIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  EnvelopeIcon,
  UserIcon,
  ShieldCheckIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function TeamInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  // React Query hooks
  const { data: userTeams, isLoading: isLoadingTeams } = useTeams();
  const { 
    data: invitationData, 
    isLoading, 
    error,
    refetch
  } = useInvitationByToken(token || null);
  
  const acceptInvitationMutation = useAcceptInvitation();

  const [isAccepting, setIsAccepting] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  // Check if user is already a member of this team
  useEffect(() => {
    if (invitationData && userTeams) {
      const alreadyMember = userTeams.some(team => team.id === invitationData.team.id);
      setIsAlreadyMember(alreadyMember || invitationData.meta?.isAlreadyMember || false);
      
      // If already a member and authenticated, redirect after a delay
      if (alreadyMember && isAuthenticated) {
        const timer = setTimeout(() => {
          navigate(`/teams/${invitationData.team.id}`);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [invitationData, userTeams, isAuthenticated, navigate]);

  const handleAcceptInvitation = async () => {
    if (!token || !isAuthenticated) {
      toast.error('You need to be logged in to accept invitations');
      navigate('/login', { state: { returnTo: `/teams/invitation/${token}` } });
      return;
    }

    if (!invitationData) {
      toast.error('Invitation data not loaded');
      return;
    }

    // Check if invitation is for current user
    if (user?.email !== invitationData.invitation.email) {
      toast.error('This invitation is not for your account', {
        description: `Invitation is for ${invitationData.invitation.email}, but you're logged in as ${user?.email}`,
      });
      return;
    }

    // Check if already a member
    if (isAlreadyMember) {
      toast.info('You are already a member of this team');
      navigate(`/teams/${invitationData.team.id}`);
      return;
    }

    setIsAccepting(true);
    
    acceptInvitationMutation.mutate(token, {
      onSuccess: (data) => {
        // Navigate to the team page after showing success toast
        setTimeout(() => {
          navigate(`/teams/${data.team.id}`);
        }, 1500);
      },
      onError: (error) => {
        console.error('Failed to accept invitation:', error);
      },
      onSettled: () => {
        setIsAccepting(false);
      }
    });
  };

  const handleLoginRedirect = () => {
    navigate('/login', { state: { returnTo: `/teams/invitation/${token}` } });
  };

  const handleSignupRedirect = () => {
    navigate('/signup', { state: { returnTo: `/teams/invitation/${token}` } });
  };

  const handleLogout = () => {
    navigate('/logout', { state: { returnTo: `/teams/invitation/${token}` } });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'member': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <XCircleIcon className="h-16 w-16 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Invitation Error</CardTitle>
            <CardDescription>
              {error?.message || 'Failed to load invitation'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This invitation may have expired, been revoked, or is invalid.
            </p>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {error?.message || 'Unable to load invitation details'}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Homepage
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="w-full"
            >
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const { invitation, team, inviter, meta } = invitationData;
  const isExpired = meta?.isExpired || new Date(invitation.expiresAt) < new Date();
  const isValid = meta?.isValid || (invitation.status === 'pending' && !isExpired);
  const canAccept = meta?.canAccept || (isValid && !isAlreadyMember);
  const isAlreadyLoggedIn = isAuthenticated;
  const isForCurrentUser = isAlreadyLoggedIn && user?.email === invitation.email;

  // If already a member and authenticated, show different UI
  if (isAlreadyMember && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <CheckCircleIcon className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Already a Member</CardTitle>
            <CardDescription>
              You're already a member of this team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold">{team.name}</h3>
                {team.description && (
                  <p className="text-muted-foreground mt-2">{team.description}</p>
                )}
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium mb-2">Your Current Role:</p>
                <Badge className={getRoleColor(
                  userTeams?.find(t => t.id === team.id)?.userRole || 'member'
                ) + " text-lg px-4 py-2"}>
                  {userTeams?.find(t => t.id === team.id)?.userRole || 'member'}
                </Badge>
              </div>
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  You've already accepted this invitation. Redirecting to team page...
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button 
              onClick={() => navigate(`/teams/${team.id}`)}
              className="w-full"
            >
              <ArrowRightIcon className="h-4 w-4 mr-2" />
              Go to Team Now
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <UsersIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Team Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a team on Minglee
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Team Info */}
          <div className="space-y-4 text-center">
            <div>
              <h3 className="text-xl font-semibold">{team.name}</h3>
              {team.description && (
                <p className="text-muted-foreground mt-1 text-sm">{team.description}</p>
              )}
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <Badge 
                variant="outline" 
                className={getRoleColor(invitation.role) + " capitalize"}
              >
                {invitation.role}
              </Badge>
              <Badge variant={isExpired || !isValid ? "destructive" : "default"}>
                {!isValid ? 'Invalid' : isExpired ? 'Expired' : 'Active'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <EnvelopeIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Invited Email</p>
                <p className="text-sm text-muted-foreground break-all">{invitation.email}</p>
                {isAlreadyLoggedIn && (
                  <p className="text-xs mt-1">
                    <span className={isForCurrentUser ? "text-green-600" : "text-amber-600"}>
                      {isForCurrentUser ? '✓ This is your current email' : '⚠ This is not your current email'}
                    </span>
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={inviter.avatarUrl || undefined} />
                <AvatarFallback>
                  {inviter.name?.charAt(0) || inviter.email?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">Invited by</p>
                <p className="text-sm text-muted-foreground">{inviter.name}</p>
                <p className="text-xs text-muted-foreground">{inviter.email}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <ClockIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Expires</p>
                <p className="text-sm text-muted-foreground">{formatDate(invitation.expiresAt)}</p>
                {isExpired && (
                  <p className="text-xs text-destructive mt-1">This invitation has expired</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Status Messages */}
          {!isValid ? (
            <Alert variant="destructive">
              <XCircleIcon className="h-4 w-4" />
              <AlertDescription>
                {isExpired 
                  ? 'This invitation has expired. Please request a new invitation from the team owner.'
                  : 'This invitation is no longer valid. It may have been revoked or already used.'}
              </AlertDescription>
            </Alert>
          ) : isAlreadyLoggedIn && !isForCurrentUser ? (
            <Alert variant="warning" className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800">
                <p className="font-medium mb-1">Account Mismatch</p>
                <p className="text-sm">
                  This invitation is for <strong>{invitation.email}</strong>, but you're logged in as <strong>{user?.email}</strong>.
                </p>
              </AlertDescription>
            </Alert>
          ) : !isAlreadyLoggedIn ? (
            <Alert>
              <UserIcon className="h-4 w-4" />
              <AlertDescription>
                You need to log in to accept this invitation.
              </AlertDescription>
            </Alert>
          ) : isForCurrentUser && canAccept && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                You're logged in with the correct email. Ready to join the team!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-3">
          {!isValid ? (
            <Button disabled className="w-full">
              <XCircleIcon className="h-4 w-4 mr-2" />
              {isExpired ? 'Invitation Expired' : 'Invalid Invitation'}
            </Button>
          ) : isAlreadyLoggedIn ? (
            isForCurrentUser ? (
              <>
                <Button 
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting || !canAccept}
                  className="w-full"
                >
                  {isAccepting ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                {acceptInvitationMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Failed to accept invitation: {acceptInvitationMutation.error?.message}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="space-y-2 w-full">
                <p className="text-sm text-center text-muted-foreground">
                  Log in with {invitation.email} to accept this invitation
                </p>
                <Button variant="outline" onClick={handleLogout} className="w-full">
                  Log Out & Switch Account
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-2 w-full">
              <Button onClick={handleLoginRedirect} className="w-full">
                <UserIcon className="h-4 w-4 mr-2" />
                Log In to Accept
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <button
                  onClick={handleSignupRedirect}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}
          
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex-1"
            >
              Go to Home
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/settings/teams')}
              className="flex-1"
            >
              <ShieldCheckIcon className="h-4 w-4 mr-2" />
              My Teams
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}