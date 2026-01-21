import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface BroadcastStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface Broadcast {
  id: string;
  userId: string;
  name: string;
  description?: string;
  
  // Template reference
  templateId?: string;
  template?: {
    id: string;
    name: string;
    category: string;
    language: string;
  };
  
  // Audience configuration
  audienceType: 'all' | 'tags' | 'segments' | 'contacts';
  audienceFilter: {
    tags?: string[];
    segments?: string[];
    contacts?: string[];
  };
  audienceCount: number;
  
  // Content
  variables?: Record<string, string>;
  mediaUrl?: string;
  message?: string;
  mediaAttachmentId?: string;
  
  // Status & scheduling
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'paused';
  scheduledAt?: string;
  sentAt?: string;
  completedAt?: string;
  
  // Statistics
  stats: BroadcastStats;
  
  // Metadata
  metadata?: Record<string, any>;
  error?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastMessage {
  id: string;
  broadcastId: string;
  contactId: string;
  messageId?: string;
  status: string;
  whatsappMessageId?: string;
  whatsappStatus?: string;
  error?: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface CreateBroadcastDto {
  name: string;
  templateId?: string;
  audienceType: 'all' | 'tags' | 'segments' | 'contacts';
  audienceFilter: {
    tags?: string[];
    segments?: string[];
    contacts?: string[];
  };
  variables?: Record<string, string>;
  mediaUrl?: string;
  scheduleType: 'now' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
  message?: string;
  mediaAttachmentId?: string;
}

export interface UpdateBroadcastDto {
  name?: string;
  status?: 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'failed';
  scheduledAt?: string;
}

export interface BroadcastFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BroadcastsResponse {
  success: boolean;
  data: {
    broadcasts: Broadcast[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color: string;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastStatsOverview {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  recent: Broadcast[];
  totalMessages?: number;
}

// API Calls
export const broadcastsApi = {
  // Get broadcasts with filters
  getBroadcasts: async (filters: BroadcastFilters = {}): Promise<BroadcastsResponse> => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    const queryString = params.toString();
    return await api.get(`/broadcasts${queryString ? `?${queryString}` : ''}`);
  },

  // Get broadcast by ID
  getBroadcast: async (id: string): Promise<{ 
    success: boolean; 
    data: { 
      broadcast: Broadcast; 
      messages: BroadcastMessage[] 
    } 
  }> => {
    return await api.get(`/broadcasts/${id}`);
  },

  // Create broadcast
  createBroadcast: async (data: CreateBroadcastDto): Promise<{ 
    success: boolean; 
    data: Broadcast 
  }> => {
    return await api.post('/broadcasts', data);
  },

  // Update broadcast
  updateBroadcast: async (id: string, data: UpdateBroadcastDto): Promise<{ 
    success: boolean; 
    data: Broadcast 
  }> => {
    return await api.put(`/broadcasts/${id}`, data);
  },

  // Delete broadcast
  deleteBroadcast: async (id: string): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    return await api.delete(`/broadcasts/${id}`);
  },

  // Start/send broadcast
  startBroadcast: async (id: string): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    return await api.post(`/broadcasts/${id}/start`);
  },

  // Pause broadcast
  pauseBroadcast: async (id: string): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    return await api.post(`/broadcasts/${id}/pause`);
  },

  // Get broadcast statistics
  getStats: async (): Promise<{ 
    success: boolean; 
    data: BroadcastStatsOverview 
  }> => {
    return await api.get('/broadcasts/stats');
  },

  // Get tags for audience selection
  getAudienceTags: async (): Promise<{ 
    success: boolean; 
    data: Tag[] 
  }> => {
    return await api.get('/broadcasts/audience/tags');
  },

  // Get broadcast messages
  getBroadcastMessages: async (
    broadcastId: string,
    page?: number,
    limit?: number
  ): Promise<{ 
    success: boolean; 
    data: {
      messages: BroadcastMessage[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }
  }> => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    return await api.get(`/broadcasts/${broadcastId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  // Retry failed broadcast message
  retryBroadcastMessage: async (
    broadcastId: string,
    messageId: string
  ): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    return await api.post(`/broadcasts/${broadcastId}/messages/${messageId}/retry`);
  },

  // Cancel broadcast
  cancelBroadcast: async (id: string): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    return await api.post(`/broadcasts/${id}/cancel`);
  },

  // Duplicate broadcast
  duplicateBroadcast: async (id: string, name?: string): Promise<{ 
    success: boolean; 
    data: Broadcast 
  }> => {
    return await api.post(`/broadcasts/${id}/duplicate`, { name });
  },
};

// React Query Hooks
export const useBroadcasts = (filters: BroadcastFilters = {}) => {
  return useQuery({
    queryKey: ['broadcasts', filters],
    queryFn: () => broadcastsApi.getBroadcasts(filters),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useBroadcast = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['broadcast', id],
    queryFn: () => broadcastsApi.getBroadcast(id),
    select: (data) => data.data,
    enabled: !!id && (options?.enabled ?? true),
  });
};

export const useCreateBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: broadcastsApi.createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

export const useUpdateBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBroadcastDto }) =>
      broadcastsApi.updateBroadcast(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

export const useDeleteBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: broadcastsApi.deleteBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

export const useStartBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: broadcastsApi.startBroadcast,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast', id] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

export const usePauseBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: broadcastsApi.pauseBroadcast,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast', id] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

export const useBroadcastStats = () => {
  return useQuery({
    queryKey: ['broadcast-stats'],
    queryFn: () => broadcastsApi.getStats(),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAudienceTags = () => {
  return useQuery({
    queryKey: ['audience-tags'],
    queryFn: () => broadcastsApi.getAudienceTags(),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useBroadcastMessages = (broadcastId: string, page?: number, limit?: number) => {
  return useQuery({
    queryKey: ['broadcast-messages', broadcastId, page, limit],
    queryFn: () => broadcastsApi.getBroadcastMessages(broadcastId, page, limit),
    select: (data) => data.data,
    enabled: !!broadcastId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useRetryBroadcastMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ broadcastId, messageId }: { broadcastId: string; messageId: string }) =>
      broadcastsApi.retryBroadcastMessage(broadcastId, messageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadcast', variables.broadcastId] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-messages', variables.broadcastId] });
    },
  });
};

export const useDuplicateBroadcast = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      broadcastsApi.duplicateBroadcast(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-stats'] });
    },
  });
};

// Zustand Store for Broadcasts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BroadcastStore {
  // Selected audience for multi-step form
  selectedAudience: {
    type: 'all' | 'tags' | 'segments' | 'contacts';
    tags: string[];
    contacts: string[];
  };
  
  // Selected template
  selectedTemplateId?: string;
  
  // Template variables
  variables: Record<string, string>;
  
  // Media URL
  mediaUrl: string;
  
  // Schedule
  scheduleType: 'now' | 'scheduled';
  scheduledDate: string;
  scheduledTime: string;
  
  // Broadcast name
  name: string;
  
  // Actions
  setSelectedAudience: (audience: Partial<BroadcastStore['selectedAudience']>) => void;
  setSelectedTemplateId: (templateId?: string) => void;
  setVariable: (key: string, value: string) => void;
  setVariables: (variables: Record<string, string>) => void;
  setMediaUrl: (url: string) => void;
  setSchedule: (schedule: Partial<Pick<BroadcastStore, 'scheduleType' | 'scheduledDate' | 'scheduledTime'>>) => void;
  setName: (name: string) => void;
  resetForm: () => void;
  loadFromBroadcast: (broadcast: Broadcast) => void;
}

export const useBroadcastStore = create<BroadcastStore>()(
  persist(
    (set) => ({
      selectedAudience: {
        type: 'all',
        tags: [],
        contacts: [],
      },
      selectedTemplateId: undefined,
      variables: {},
      mediaUrl: '',
      scheduleType: 'now',
      scheduledDate: '',
      scheduledTime: '',
      name: '',
      
      setSelectedAudience: (audience) =>
        set((state) => ({
          selectedAudience: { ...state.selectedAudience, ...audience },
        })),
      
      setSelectedTemplateId: (templateId) =>
        set({ selectedTemplateId: templateId }),
      
      setVariable: (key, value) =>
        set((state) => ({
          variables: { ...state.variables, [key]: value },
        })),
      
      setVariables: (variables) =>
        set({ variables }),
      
      setMediaUrl: (url) =>
        set({ mediaUrl: url }),
      
      setSchedule: (schedule) =>
        set((state) => ({ ...state, ...schedule })),
      
      setName: (name) =>
        set({ name }),
      
      resetForm: () =>
        set({
          selectedAudience: {
            type: 'all',
            tags: [],
            contacts: [],
          },
          selectedTemplateId: undefined,
          variables: {},
          mediaUrl: '',
          scheduleType: 'now',
          scheduledDate: '',
          scheduledTime: '',
          name: '',
        }),
      
      loadFromBroadcast: (broadcast) =>
        set({
          selectedAudience: {
            type: broadcast.audienceType,
            tags: broadcast.audienceFilter.tags || [],
            contacts: broadcast.audienceFilter.contacts || [],
          },
          selectedTemplateId: broadcast.templateId,
          variables: broadcast.variables || {},
          mediaUrl: broadcast.mediaUrl || '',
          scheduleType: broadcast.scheduledAt ? 'scheduled' : 'now',
          scheduledDate: broadcast.scheduledAt ? broadcast.scheduledAt.split('T')[0] : '',
          scheduledTime: broadcast.scheduledAt ? broadcast.scheduledAt.split('T')[1].substring(0, 5) : '',
          name: broadcast.name,
        }),
    }),
    {
      name: 'broadcast-form-storage',
      // Only persist certain fields
      partialize: (state) => ({
        selectedAudience: state.selectedAudience,
        selectedTemplateId: state.selectedTemplateId,
        variables: state.variables,
        mediaUrl: state.mediaUrl,
        scheduleType: state.scheduleType,
        scheduledDate: state.scheduledDate,
        scheduledTime: state.scheduledTime,
        name: state.name,
      }),
    }
  )
);