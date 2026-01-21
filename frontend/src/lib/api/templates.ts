// frontend/src/lib/api/templates.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
    body_text_named_params?: Array<{
      param_name: string;
      example: string;
    }>;
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  required: boolean;
  example?: string;
  description?: string;
}

export interface Template {
  id: string;
  name: string;
  category?: string;
  language: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  components: TemplateComponent[];
  variables?: TemplateVariable[];
  whatsappTemplateId?: string;
  metaTemplateId?: string;
  metaStatus?: string;
  meta_review_feedback?: string;
  quality_rating?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  category?: string;
  language?: string;
  components: TemplateComponent[];
  variables?: TemplateVariable[];
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  status?: 'pending' | 'approved' | 'rejected' | 'disabled';
}

export interface TemplateFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  language?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TemplatesResponse {
  success: boolean;
  data: Template[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TemplateStats {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  approvedCount: number;
}

// API Calls
export const templatesApi = {
  // Get templates with filters
  getTemplates: async (filters: TemplateFilters = {}): Promise<TemplatesResponse> => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.language) params.append('language', filters.language);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    const queryString = params.toString();
    return await api.get(`/templates${queryString ? `?${queryString}` : ''}`);
  },

  // Get template by ID
  getTemplate: async (id: string): Promise<{ success: boolean; data: Template }> => {
    return await api.get(`/templates/${id}`);
  },

  // Create template
  createTemplate: async (data: CreateTemplateDto): Promise<{ success: boolean; data: Template }> => {
    return await api.post('/templates', data);
  },

  // Update template
  updateTemplate: async (id: string, data: UpdateTemplateDto): Promise<{ success: boolean; data: Template }> => {
    return await api.put(`/templates/${id}`, data);
  },

  // Delete template
  deleteTemplate: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.delete(`/templates/${id}`);
  },

  // Sync WhatsApp templates
  syncWhatsAppTemplates: async (): Promise<{ success: boolean; message: string; count?: number }> => {
    return await api.post('/templates/sync/whatsapp', {});
  },

 // Send template message
  sendTemplateMessage: async (
    templateId: string,
    contactId: string,
    parameters: Record<string, any>
  ): Promise<{ success: boolean; data: any; message: string }> => {
    return await api.post(`/templates/${templateId}/send`, { contactId, parameters });
  },

  // Get approved templates for selection
  getApprovedTemplates: async (): Promise<{ success: boolean; data: Template[] }> => {
    return await api.get('/templates?status=approved');
  },

  // Get template stats
  getStats: async (): Promise<{ success: boolean; data: TemplateStats }> => {
    return await api.get('/templates/stats/overview');
  },

  // Get template categories
  getCategories: async (): Promise<{ success: boolean; data: string[] }> => {
    return await api.get('/templates/categories/list');
  },

  // Preview template
  previewTemplate: async (
    templateId: string,
    sampleData: Record<string, any>
  ): Promise<{ success: boolean; data: { template: Template; preview: any } }> => {
    return await api.post(`/templates/${templateId}/preview`, { sampleData });
  },

  // Duplicate template
  duplicateTemplate: async (templateId: string, name?: string): Promise<{ success: boolean; data: Template }> => {
    return await api.post(`/templates/${templateId}/duplicate`, { name });
  },

  // Refresh template status from Meta
  refreshTemplateStatus: async (templateId: string): Promise<{ 
    success: boolean; 
    data: Template; 
    message: string 
  }> => {
    return await api.post(`/templates/${templateId}/refresh-status`, {});
  },

  // Force sync template from Meta
  forceSyncTemplate: async (templateId: string): Promise<{ 
    success: boolean; 
    data: Template; 
    message: string 
  }> => {
    return await api.post(`/templates/${templateId}/force-sync`, {});
  },

    // Upload media for templates
  uploadMedia: async (file: File): Promise<{
    success: boolean;
    data?: {
      id: string;
      secureUrl: string;
      originalFilename: string;
      mimeType: string;
      fileSize: number;
      width?: number;
      height?: number;
      duration?: number;
      publicId?: string;
    };
    error?: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    return await api.request('/templates/upload-media', {
      method: 'POST',
      body: formData,
    });
  },
};


// React Query Hooks
export const useTemplates = (filters: TemplateFilters = {}) => {
  return useQuery({
    queryKey: ['templates', filters],
    queryFn: () => templatesApi.getTemplates(filters),
    select: (data) => data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useTemplate = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => templatesApi.getTemplate(id),
    select: (data) => data.data,
    enabled: !!id && (options?.enabled ?? true),
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: templatesApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-stats'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateDto }) =>
      templatesApi.updateTemplate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['template-stats'] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: templatesApi.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-stats'] });
    },
  });
};

export const useSyncWhatsAppTemplates = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: templatesApi.syncWhatsAppTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-stats'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
    },
  });
};

export const useTemplateStats = () => {
  return useQuery({
    queryKey: ['template-stats'],
    queryFn: () => templatesApi.getStats(),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useTemplateCategories = () => {
  return useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templatesApi.getCategories(),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const usePreviewTemplate = () => {
  return useMutation({
    mutationFn: ({ templateId, sampleData }: { templateId: string; sampleData: Record<string, any> }) =>
      templatesApi.previewTemplate(templateId, sampleData),
  });
};

export const useDuplicateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
      templatesApi.duplicateTemplate(templateId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useSendTemplateMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      templateId, 
      contactId, 
      parameters 
    }: { 
      templateId: string; 
      contactId: string; 
      parameters: Record<string, any> 
    }) => templatesApi.sendTemplateMessage(templateId, contactId, parameters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
};

// NEW: Refresh template status hook
export const useRefreshTemplateStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: templatesApi.refreshTemplateStatus,
    onSuccess: (data, templateId) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
    },
  });
};

// NEW: Force sync template hook
export const useForceSyncTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: templatesApi.forceSyncTemplate,
    onSuccess: (data, templateId) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
    },
  });
};

export const useApprovedTemplates = () => {
  return useQuery({
    queryKey: ['templates', 'approved'],
    queryFn: () => templatesApi.getApprovedTemplates(),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};