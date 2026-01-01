// frontend/src/lib/api/teams.ts
import { toast } from '@/components/ui/sonner';
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  settings: {
    canInviteMembers: boolean;
    maxMembers: number;
    allowMemberDeletion: boolean;
    defaultRole: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  userRole: string;
  userStatus: string;
  joinedAt: string;
  members?: TeamMember[];
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  settings?: {
    canInviteMembers?: boolean;
    maxMembers?: number;
    allowMemberDeletion?: boolean;
    defaultRole?: string;
  };
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  settings?: any;
}

export interface InviteMemberDto {
  email: string;
  role?: string;
}

export interface UpdateMemberRoleDto {
  role?: string;
  permissions?: any;
}

export const teamsApi = {
  // Get user's teams
  getAll: async (): Promise<Team[]> => {
    try {
      const response = await api.get('/teams');
      
      if (response && response.success === true) {
        return response.teams || [];
      }
      
      throw new Error(response?.error || 'Failed to fetch teams');
      
    } catch (error: any) {
      console.error('Failed to fetch teams:', error);
      throw new Error('Failed to fetch teams: ' + error.message);
    }
  },

  // Get team by ID
  getById: async (id: string): Promise<Team> => {
    try {
      const response = await api.get(`/teams/${id}`);
      
      if (response && response.success === true) {
        return response.team;
      }
      
      throw new Error(response?.error || 'Failed to fetch team');
      
    } catch (error: any) {
      console.error('Failed to fetch team:', error);
      throw new Error('Failed to fetch team: ' + error.message);
    }
  },

  // Create new team
  create: async (data: CreateTeamDto): Promise<Team> => {
    try {
      const response = await api.post('/teams', data);
      
      if (response && response.success === true) {
        return response.team;
      }
      
      throw new Error(response?.error || 'Failed to create team');
      
    } catch (error: any) {
      console.error('Failed to create team:', error);
      throw new Error('Failed to create team: ' + error.message);
    }
  },

  // Update team
  update: async (id: string, data: UpdateTeamDto): Promise<Team> => {
    try {
      const response = await api.put(`/teams/${id}`, data);
      
      if (response && response.success === true) {
        return response.team;
      }
      
      throw new Error(response?.error || 'Failed to update team');
      
    } catch (error: any) {
      console.error('Failed to update team:', error);
      throw new Error('Failed to update team: ' + error.message);
    }
  },

  // Delete team
  delete: async (id: string): Promise<void> => {
    try {
      const response = await api.delete(`/teams/${id}`);
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to delete team');
      }
      
      return;
      
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      throw new Error('Failed to delete team: ' + error.message);
    }
  },

  // Invite member
  inviteMember: async (teamId: string, data: InviteMemberDto): Promise<TeamInvitation> => {
    try {
      const response = await api.post(`/teams/${teamId}/invite`, data);
      
      if (response && response.success === true) {
        return response.invitation;
      }
      
      throw new Error(response?.error || 'Failed to invite member');
      
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      throw new Error('Failed to invite member: ' + error.message);
    }
  },

  // Remove member
  removeMember: async (teamId: string, memberId: string): Promise<void> => {
    try {
      const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to remove member');
      }
      
      return;
      
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      throw new Error('Failed to remove member: ' + error.message);
    }
  },

  // Update member role
  updateMemberRole: async (teamId: string, memberId: string, data: UpdateMemberRoleDto): Promise<TeamMember> => {
    try {
      const response = await api.put(`/teams/${teamId}/members/${memberId}/role`, data);
      
      if (response && response.success === true) {
        return response.member;
      }
      
      throw new Error(response?.error || 'Failed to update member role');
      
    } catch (error: any) {
      console.error('Failed to update member role:', error);
      throw new Error('Failed to update member role: ' + error.message);
    }
  },

  // Leave team
  leaveTeam: async (teamId: string): Promise<void> => {
    try {
      const response = await api.post(`/teams/${teamId}/leave`);
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to leave team');
      }
      
      return;
      
    } catch (error: any) {
      console.error('Failed to leave team:', error);
      throw new Error('Failed to leave team: ' + error.message);
    }
  },

  // Get team invitations
  getTeamInvitations: async (teamId: string): Promise<TeamInvitation[]> => {
    try {
      const response = await api.get(`/teams/${teamId}/invitations`);
      
      if (response && response.success === true) {
        return response.invitations || [];
      }
      
      throw new Error(response?.error || 'Failed to fetch invitations');
      
    } catch (error: any) {
      console.error('Failed to fetch invitations:', error);
      throw new Error('Failed to fetch invitations: ' + error.message);
    }
  },

  // Revoke invitation
  revokeInvitation: async (invitationId: string): Promise<void> => {
    try {
      const response = await api.delete(`/teams/invitation/${invitationId}`);
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to revoke invitation');
      }
      
      return;
      
    } catch (error: any) {
      console.error('Failed to revoke invitation:', error);
      throw new Error('Failed to revoke invitation: ' + error.message);
    }
  },

  // Get invitation by token
  getInvitationByToken: async (token: string): Promise<{ 
    invitation: TeamInvitation; 
    team: Team; 
    inviter: { id: string; name: string; email: string } 
  }> => {
    try {
      const response = await api.get(`/teams/invitation/${token}`);
      
      if (response && response.success === true) {
        return response;
      }
      
      throw new Error(response?.error || 'Failed to fetch invitation');
      
    } catch (error: any) {
      console.error('Failed to fetch invitation:', error);
      throw new Error('Failed to fetch invitation: ' + error.message);
    }
  },

  // Accept invitation
acceptInvitation: async (token: string): Promise<{ team: Team; role: string }> => {
  try {
    const response = await api.post(`/teams/invitation/${token}/accept`);
    
    if (response && response.success === true) {
      return {
        team: response.team,
        role: response.role
      };
    }
    
    throw new Error(response?.error || 'Failed to accept invitation');
    
  } catch (error: any) {
    console.error('Failed to accept invitation:', error);
    throw new Error('Failed to accept invitation: ' + error.message);
  }
},
};

// React Query hooks
export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useTeam = (id: string | null) => {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () => teamsApi.getById(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useTeamInvitations = (teamId: string | null) => {
  return useQuery({
    queryKey: ['teams', teamId, 'invitations'],
    queryFn: () => teamsApi.getTeamInvitations(teamId!),
    enabled: !!teamId,
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create team:', error);
    },
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamDto }) => 
      teamsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.id] });
    },
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: teamsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useInviteMember = (teamId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InviteMemberDto) => teamsApi.inviteMember(teamId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] });
    },
    enabled: !!teamId,
  });
};

export const useRemoveMember = (teamId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (memberId: string) => teamsApi.removeMember(teamId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
    },
    enabled: !!teamId,
  });
};

export const useUpdateMemberRole = (teamId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: UpdateMemberRoleDto }) => 
      teamsApi.updateMemberRole(teamId!, memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
    },
    enabled: !!teamId,
  });
};

export const useLeaveTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: teamsApi.leaveTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useRevokeInvitation = (teamId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: teamsApi.revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] });
    },
    enabled: !!teamId,
  });
};

// Add hooks for invitation acceptance
export const useInvitationByToken = (token: string | null) => {
  return useQuery({
    queryKey: ['teams', 'invitation', token],
    queryFn: () => teamsApi.getInvitationByToken(token!),
    enabled: !!token,
  });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: teamsApi.acceptInvitation,
    onSuccess: (data) => {
      // Invalidate ALL teams-related queries
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', 'invitation'] });
      queryClient.invalidateQueries({ queryKey: ['teams', data.team.id] });
      queryClient.invalidateQueries({ queryKey: ['teams', data.team.id, 'invitations'] });
      
      toast.success('Invitation accepted!', {
        description: `You've joined ${data.team.name} as a ${data.role}`,
        duration: 2000,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to accept invitation', {
        description: error.message,
      });
    },
  });
};