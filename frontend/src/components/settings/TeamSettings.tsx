// frontend/src/components/settings/TeamSettings.tsx
import React, { useState } from 'react';
import { 
  useTeams, 
  useTeam, 
  useTeamInvitations,
  useCreateTeam, 
  useDeleteTeam,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useLeaveTeam,
  useRevokeInvitation,
  type Team,
  type TeamMember,
  type TeamInvitation
} from '@/lib/api/teams';
import { useTeamsStore } from '@/stores/teams.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  UsersIcon,
  PlusIcon,
  EnvelopeIcon,
  TrashIcon,
  UserMinusIcon,
  PencilIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function TeamSettings() {
  const { user } = useAuthStore();
  const { selectedTeamId, setSelectedTeamId } = useTeamsStore();
  
  // React Query hooks
  const { data: teams = [], isLoading: isLoadingTeams, refetch: refetchTeams } = useTeams();
  const { data: selectedTeam, isLoading: isLoadingTeam, refetch: refetchTeam } = useTeam(selectedTeamId);
  const { data: invitations = [], refetch: refetchInvitations } = useTeamInvitations(selectedTeamId);
  
  // Mutations
  const createTeamMutation = useCreateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const inviteMemberMutation = useInviteMember(selectedTeamId);
  const removeMemberMutation = useRemoveMember(selectedTeamId);
  const updateMemberRoleMutation = useUpdateMemberRole(selectedTeamId);
  const leaveTeamMutation = useLeaveTeam();
  const revokeInvitationMutation = useRevokeInvitation(selectedTeamId);
  
  // Local state
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Auto-select first team on initial load
  React.useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId, setSelectedTeamId]);

  const handleSelectTeam = (team: Team) => {
    setSelectedTeamId(team.id);
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      await createTeamMutation.mutateAsync({
        name: newTeamName,
        description: newTeamDescription || undefined,
      });
      
      toast.success('Team created successfully');
      setNewTeamName('');
      setNewTeamDescription('');
      setIsCreatingTeam(false);
      await refetchTeams();
      
    } catch (error: any) {
      toast.error('Failed to create team', {
        description: error.message,
      });
    }
  };

  const inviteMember = async () => {
    if (!selectedTeamId || !inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      await inviteMemberMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      
      toast.success('Invitation sent successfully');
      setInviteEmail('');
      setInviteRole('member');
      setIsInvitingMember(false);
      refetchInvitations();
      
    } catch (error: any) {
      toast.error('Failed to send invitation', {
        description: error.message,
      });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeamId) return;

    try {
      await removeMemberMutation.mutateAsync(memberId);
      toast.success('Member removed successfully');
      refetchTeam();
      
    } catch (error: any) {
      toast.error('Failed to remove member', {
        description: error.message,
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    if (!selectedTeamId) return;

    try {
      await updateMemberRoleMutation.mutateAsync({
        memberId,
        data: { role: newRole }
      });
      toast.success('Member role updated successfully');
      refetchTeam();
      
    } catch (error: any) {
      toast.error('Failed to update member role', {
        description: error.message,
      });
    }
  };

  const leaveTeam = async (teamId: string) => {
    try {
      await leaveTeamMutation.mutateAsync(teamId);
      toast.success('You have left the team');
      await refetchTeams();
      
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null);
      }
      
    } catch (error: any) {
      toast.error('Failed to leave team', {
        description: error.message,
      });
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    try {
      await revokeInvitationMutation.mutateAsync(invitationId);
      toast.success('Invitation revoked successfully');
      refetchInvitations();
      
    } catch (error: any) {
      toast.error('Failed to revoke invitation', {
        description: error.message,
      });
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      try {
        await deleteTeamMutation.mutateAsync(teamId);
        toast.success('Team deleted successfully');
        await refetchTeams();
        
        if (selectedTeamId === teamId) {
          setSelectedTeamId(null);
        }
        
      } catch (error: any) {
        toast.error('Failed to delete team', {
          description: error.message,
        });
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'member': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const canManageTeam = (team: Team) => {
    if (!user) return false;
    return team.userRole === 'owner' || team.userRole === 'admin';
  };

  const canManageMember = (member: TeamMember) => {
    if (!selectedTeam || !user) return false;
    
    // User can't manage themselves
    if (member.user.id === user.id) return false;
    
    const userRole = selectedTeam.userRole;
    const memberRole = member.role;
    
    // Owners can manage everyone except other owners
    if (userRole === 'owner') return memberRole !== 'owner';
    
    // Admins can manage managers, members, and viewers
    if (userRole === 'admin') {
      return ['manager', 'member', 'viewer'].includes(memberRole);
    }
    
    // Managers can manage members and viewers
    if (userRole === 'manager') {
      return ['member', 'viewer'].includes(memberRole);
    }
    
    return false;
  };

  const isLoading = isLoadingTeams || isLoadingTeam;
  const displayTeam = selectedTeam;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground">
            Create and manage teams, invite members, and set permissions
          </p>
        </div>
        <Dialog open={isCreatingTeam} onOpenChange={setIsCreatingTeam}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team to collaborate with others
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="team-name" className="text-sm font-medium">
                  Team Name *
                </label>
                <Input
                  id="team-name"
                  placeholder="e.g., Marketing Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="team-description" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="team-description"
                  placeholder="Optional team description"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingTeam(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createTeam}
                disabled={createTeamMutation.isPending}
              >
                {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first team to start collaborating with others
            </p>
            <Button onClick={() => setIsCreatingTeam(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Teams</CardTitle>
                <CardDescription>
                  Select a team to manage its members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        selectedTeamId === team.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-secondary"
                      )}
                      onClick={() => handleSelectTeam(team)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <UsersIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{team.name}</h4>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              getRoleColor(team.userRole)
                            )}
                          >
                            {team.userRole}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {team.memberCount || team.members?.length || 0} members
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Details */}
          <div className="lg:col-span-2">
            {displayTeam ? (
              <Tabs defaultValue="members">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{displayTeam.name}</h3>
                    {displayTeam.description && (
                      <p className="text-muted-foreground">{displayTeam.description}</p>
                    )}
                  </div>
                  <TabsList>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="invitations">Invitations</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                </div>

                {/* Members Tab */}
                <TabsContent value="members">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Team Members</CardTitle>
                          <CardDescription>
                            Manage members and their permissions
                          </CardDescription>
                        </div>
                        {canManageTeam(displayTeam) && (
                          <Dialog open={isInvitingMember} onOpenChange={setIsInvitingMember}>
                            <DialogTrigger asChild>
                              <Button size="sm">
                                <UserPlusIcon className="w-4 h-4 mr-2" />
                                Invite Member
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Invite Team Member</DialogTitle>
                                <DialogDescription>
                                  Send an invitation to join {displayTeam.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <label htmlFor="invite-email" className="text-sm font-medium">
                                    Email Address *
                                  </label>
                                  <Input
                                    id="invite-email"
                                    type="email"
                                    placeholder="colleague@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    disabled={inviteMemberMutation.isPending}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label htmlFor="invite-role" className="text-sm font-medium">
                                    Role
                                  </label>
                                  <Select 
                                    value={inviteRole} 
                                    onValueChange={setInviteRole}
                                    disabled={inviteMemberMutation.isPending}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="manager">Manager</SelectItem>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="viewer">Viewer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setIsInvitingMember(false)}
                                  disabled={inviteMemberMutation.isPending}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={inviteMember}
                                  disabled={inviteMemberMutation.isPending}
                                >
                                  {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayTeam.members?.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={member.user.avatarUrl || undefined} />
                                    <AvatarFallback>
                                      {member.user.name?.charAt(0) || member.user.email?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{member.user.name}</div>
                                    <div className="text-xs text-muted-foreground">{member.user.email}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      getRoleColor(member.role)
                                    )}
                                  >
                                    {member.role}
                                  </Badge>
                                  {member.user.id === displayTeam.ownerId && (
                                    <ShieldCheckIcon className="w-4 h-4 text-purple-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(member.joinedAt).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canManageMember(member) && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <PencilIcon className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {['admin', 'manager', 'member', 'viewer'].map((role) => (
                                          <DropdownMenuItem
                                            key={role}
                                            onClick={() => updateMemberRole(member.user.id, role)}
                                            disabled={member.role === role || updateMemberRoleMutation.isPending}
                                          >
                                            <span className="capitalize">{role}</span>
                                            {member.role === role && (
                                              <CheckIcon className="w-4 h-4 ml-auto" />
                                            )}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => removeMember(member.user.id)}
                                          disabled={removeMemberMutation.isPending}
                                        >
                                          <UserMinusIcon className="w-4 h-4 mr-2" />
                                          Remove from Team
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                  {member.user.id === user?.id && displayTeam.userRole !== 'owner' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => leaveTeam(displayTeam.id)}
                                      disabled={leaveTeamMutation.isPending}
                                    >
                                      {leaveTeamMutation.isPending ? 'Leaving...' : 'Leave'}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Invitations Tab */}
                <TabsContent value="invitations">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending Invitations</CardTitle>
                      <CardDescription>
                        Manage invitations sent to join this team
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {invitations.length === 0 ? (
                        <div className="text-center py-8">
                          <EnvelopeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h4 className="font-semibold mb-2">No Pending Invitations</h4>
                          <p className="text-muted-foreground">
                            Invite members to see them here
                          </p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Invited By</TableHead>
                              <TableHead>Expires</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invitations.map((invitation) => (
                              <TableRow key={invitation.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <EnvelopeIcon className="w-4 h-4 text-muted-foreground" />
                                    {invitation.email}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {invitation.role}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">{invitation.inviter.name}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ClockIcon className="w-4 h-4" />
                                    {new Date(invitation.expiresAt).toLocaleDateString()}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => revokeInvitation(invitation.id)}
                                    disabled={revokeInvitationMutation.isPending}
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                    Revoke
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings">
                  <Card>
                    <CardHeader>
                      <CardTitle>Team Settings</CardTitle>
                      <CardDescription>
                        Manage team configuration and permissions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Team Information</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Team Name</label>
                              <div className="mt-1 text-sm">{displayTeam.name}</div>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Owner</label>
                              <div className="mt-1 text-sm">
                                {displayTeam.members?.find(m => m.role === 'owner')?.user.name || 'Unknown'}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Created</label>
                              <div className="mt-1 text-sm">
                                {new Date(displayTeam.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Total Members</label>
                              <div className="mt-1 text-sm">{displayTeam.memberCount || displayTeam.members?.length || 0}</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Team Settings</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Allow Member Invitations</div>
                                <div className="text-sm text-muted-foreground">
                                  Members can invite others to join
                                </div>
                              </div>
                              <Badge variant={displayTeam.settings.canInviteMembers ? "default" : "secondary"}>
                                {displayTeam.settings.canInviteMembers ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Maximum Members</div>
                                <div className="text-sm text-muted-foreground">
                                  Limit on team size
                                </div>
                              </div>
                              <div className="text-sm font-medium">{displayTeam.settings.maxMembers}</div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Default Member Role</div>
                                <div className="text-sm text-muted-foreground">
                                  Role assigned to new members
                                </div>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {displayTeam.settings.defaultRole}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {displayTeam.userRole === 'owner' && (
                          <div className="pt-4 border-t">
                            <h4 className="font-semibold mb-4 text-destructive">Danger Zone</h4>
                            <div className="space-y-4">
                              {displayTeam.memberCount === 1 ? (
                                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                                  <div className="font-medium text-destructive mb-2">
                                    Cannot Delete Team
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    You are the only member. Please leave the team instead.
                                  </p>
                                </div>
                              ) : (
                                <Button
                                  variant="destructive"
                                  onClick={() => deleteTeam(displayTeam.id)}
                                  disabled={deleteTeamMutation.isPending}
                                >
                                  <TrashIcon className="w-4 h-4 mr-2" />
                                  {deleteTeamMutation.isPending ? 'Deleting...' : 'Delete Team'}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Team</h3>
                  <p className="text-muted-foreground">
                    Choose a team from the list to view its details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}