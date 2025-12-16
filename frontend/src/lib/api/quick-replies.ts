import { api } from '../api';

// Types
export interface QuickReply {
  id: string;
  name: string;
  message: string;
  topics: string;
  mediaAttachmentIds: string[];
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  mediaAttachments?: any[];
}

export interface CreateQuickReplyData {
  name: string;
  message: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface UpdateQuickReplyData {
  name?: string;
  message?: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface QuickReplyFilters {
  page?: number;
  limit?: number;
  search?: string;
  topics?: string[];
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QuickRepliesResponse {
  success: boolean;
  quickReplies: QuickReply[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TopicsResponse {
  success: boolean;
  topics: string[];
}

// API calls
export const quickRepliesApi = {
  // Get quick replies with filters
  getQuickReplies: async (filters: QuickReplyFilters = {}): Promise<QuickRepliesResponse> => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.topics?.length) {
      filters.topics.forEach(topic => params.append('topics', topic));
    }
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    const queryString = params.toString();
    const url = `/quick-replies${queryString ? `?${queryString}` : ''}`;
    
    return await api.get(url);
  },

  // Get quick reply by ID
  getQuickReply: async (id: string): Promise<{ success: boolean; quickReply: QuickReply }> => {
    return await api.get(`/quick-replies/${id}`);
  },

  // Create quick reply
  createQuickReply: async (data: CreateQuickReplyData): Promise<{ success: boolean; quickReply: QuickReply }> => {
    return await api.post('/quick-replies', data);
  },

  // Update quick reply
  updateQuickReply: async (id: string, data: UpdateQuickReplyData): Promise<{ success: boolean; quickReply: QuickReply }> => {
    return await api.put(`/quick-replies/${id}`, data);
  },

  // Delete quick reply
  deleteQuickReply: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.delete(`/quick-replies/${id}`);
  },

  // Duplicate quick reply
  duplicateQuickReply: async (id: string): Promise<{ success: boolean; quickReply: QuickReply }> => {
    return await api.post(`/quick-replies/${id}/duplicate`, {});
  },

  // Upload attachments
  uploadAttachments: async (id: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    return await api.request(`/quick-replies/${id}/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  // Get all topics
  getTopics: async (): Promise<TopicsResponse> => {
    return await api.get('/quick-replies/topics/all');
  },
};