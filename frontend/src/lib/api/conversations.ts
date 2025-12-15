// frontend/src/lib/api/conversations.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// Types
export interface Conversation {
  id: string;
  contactId: string;
  userId: string;
  whatsappPhoneNumberId?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'active' | 'archived' | 'muted' | 'resolved';
  createdAt: string;
  updatedAt: string;
  
  // Joined fields (from contact)
  contact?: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
    status?: string;
    tags?: string[];
  };
   assignedUser?: { // NEW: Add this
    name?: string;
    email?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  whatsappMessageId?: string;
  content: string;
  messageType: string;
  direction: 'incoming' | 'outgoing';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata: Record<string, any>;
  timestamp: string;
  createdAt: string;
  
  // For UI
  sender?: 'user' | 'contact';
}

export interface ConversationFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  channel?: string;
  sortBy?: 'lastMessageAt' | 'createdAt' | 'unreadCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ConversationsResponse {
  success: boolean;
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MessagesResponse {
  success: boolean;
  messages: Message[];
  conversation: Conversation;
  contact: any;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Helper to build query string
const buildQueryString = (filters: any = {}): string => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, String(value));
      }
    }
  });
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

// API Calls
export const conversationsApi = {
  // Get conversations with filters
  getConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    const queryString = buildQueryString(filters);
    return await api.request(`/conversations${queryString}`);
  },

  // Get single conversation with messages
  getConversation: async (id: string, page: number = 1, limit: number = 50): Promise<MessagesResponse> => {
    const queryString = buildQueryString({ page, limit });
    return await api.request(`/conversations/${id}${queryString}`);
  },

    getAssignedConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    const queryString = buildQueryString(filters);
    return await api.request(`/conversations/assigned/me${queryString}`);
  },

  // Get unassigned conversations
  getUnassignedConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    const queryString = buildQueryString(filters);
    return await api.request(`/conversations/unassigned${queryString}`);
  },

  // Assign conversation to user
  assignConversation: async (id: string, assignedToUserId?: string): Promise<{ 
    success: boolean; 
    conversation: Conversation;
    assignedUser?: { name: string; email: string };
  }> => {
    return await api.request(`/conversations/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedToUserId }),
    });
  },
  
  // Get available users for assignment (you'll need to create this endpoint)
  getAvailableUsers: async (): Promise<{ success: boolean; users: Array<{ id: string; name: string; email: string }> }> => {
    return await api.request('/users/available');
  },


  // Send message
  sendMessage: async (conversationId: string, message: string): Promise<{ success: boolean; message: Message }> => {
    return await api.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // Send media message
  sendMediaMessage: async (formData: FormData): Promise<{ success: boolean; data: any }> => {
    return await api.request('/whatsapp/send-media', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });
  },

  // Update conversation status
  updateStatus: async (id: string, status: string): Promise<{ success: boolean; conversation: Conversation }> => {
    return await api.request(`/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Mark conversation as read
  markAsRead: async (id: string): Promise<{ success: boolean; conversation: Conversation }> => {
    return await api.request(`/conversations/${id}/read`, {
      method: 'PATCH',
    });
  },

  // Get unread count
  getUnreadCount: async (): Promise<{ success: boolean; count: number }> => {
    return await api.request('/conversations/unread/count');
  },
};

// React Query Hooks
export const useConversations = (filters: ConversationFilters = {}) => {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => conversationsApi.getConversations(filters),
    select: (data) => data,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
  });
};

export const useConversation = (id: string, page: number = 1, limit: number = 50) => {
  return useQuery({
    queryKey: ['conversation', id, page, limit],
    queryFn: () => conversationsApi.getConversation(id, page, limit),
    select: (data) => data,
    enabled: !!id,
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 1000 * 10, // Auto-refresh every 10 seconds
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      conversationsApi.sendMessage(conversationId, message),
    onSuccess: (data, variables) => {
      // Invalidate conversation and messages
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};

export const useSendMediaMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (formData: FormData) => conversationsApi.sendMediaMessage(formData),
    onSuccess: (data) => {
      // Invalidate conversations to refresh the list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      toast({
        title: "Media sent",
        description: "Your files have been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send media",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateConversationStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      conversationsApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.id] });
      
      toast({
        title: "Status updated",
        description: `Conversation marked as ${variables.status}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => conversationsApi.markAsRead(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark as read",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['conversations-unread'],
    queryFn: () => conversationsApi.getUnreadCount(),
    select: (data) => data.count,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
};