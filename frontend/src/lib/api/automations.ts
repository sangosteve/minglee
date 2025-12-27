// frontend/src/lib/api/automations.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface AutomationWorkflow {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_type: string;
  trigger_config: any;
  flow_data: any;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationDto {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused';
  trigger_type?: string;
  trigger_config?: any;
  flow_data?: any;
}

export interface UpdateAutomationDto extends Partial<CreateAutomationDto> {
  id: string;
}

export interface AutomationFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AutomationsResponse {
  success: boolean;
  data: AutomationWorkflow[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AutomationStats {
  totalActive: number;
  totalDraft: number;
  totalPaused: number;
  totalArchived: number;
}

// API Calls
export const automationsApi = {
  // Get automations with filters
  getAutomations: async (filters: AutomationFilters = {}): Promise<AutomationsResponse> => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    const queryString = params.toString();
    return await api.get(`/automations${queryString ? `?${queryString}` : ''}`);
  },

  // Get automation by ID
  getAutomation: async (id: string): Promise<{ success: boolean; data: AutomationWorkflow }> => {
    return await api.get(`/automations/${id}`);
  },

  // Create automation
  createAutomation: async (data: CreateAutomationDto): Promise<{ success: boolean; data: AutomationWorkflow }> => {
    return await api.post('/automations', data);
  },

  // Update automation
  updateAutomation: async (id: string, data: Partial<CreateAutomationDto>): Promise<{ success: boolean; data: AutomationWorkflow }> => {
    return await api.put(`/automations/${id}`, data);
  },

  // Update automation status
  updateStatus: async (id: string, status: string): Promise<{ success: boolean; data: AutomationWorkflow }> => {
    return await api.patch(`/automations/${id}/status`, { status });
  },

  // Delete automation
  deleteAutomation: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.delete(`/automations/${id}`);
  },

  // Get automation stats
  getStats: async (): Promise<{ success: boolean; stats: AutomationStats }> => {
    return await api.get('/automations/stats');
  },

  // Test automation
  testAutomation: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.post(`/automations/${id}/test`, {});
  },
};

// React Query Hooks
export const useAutomations = (filters: AutomationFilters = {}) => {
  return useQuery({
    queryKey: ['automations', filters],
    queryFn: () => automationsApi.getAutomations(filters),
    select: (data) => data,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAutomation = (id: string) => {
  return useQuery({
    queryKey: ['automation', id],
    queryFn: () => automationsApi.getAutomation(id),
    select: (data) => data.data,
    enabled: !!id,
  });
};

export const useCreateAutomation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: automationsApi.createAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
  });
};

export const useUpdateAutomation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAutomationDto> }) =>
      automationsApi.updateAutomation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
  });
};

export const useDeleteAutomation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: automationsApi.deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
  });
};

export const useUpdateAutomationStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      automationsApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
  });
};

export const useAutomationStats = () => {
  return useQuery({
    queryKey: ['automation-stats'],
    queryFn: () => automationsApi.getStats(),
    select: (data) => data.stats,
    staleTime: 1000 * 60 * 5,
  });
};