// frontend/src/lib/api/conversations.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// Types
export interface Conversation {
  id: string;
  contactId: string;
  userId: string;
  assignedToUserId?: string; // Add this field
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
  assignedUser?: {
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
    const response = await api.request(`/conversations${queryString}`);
    
    // Ensure assignedToUserId is included in the response
    return {
      ...response,
      conversations: response.conversations?.map((conv: any) => ({
        ...conv,
        assignedToUserId: conv.assignedToUserId || conv.assigned_to_user_id,
      })) || []
    };
  },

  // Get single conversation with messages
  getConversation: async (id: string, page: number = 1, limit: number = 50): Promise<MessagesResponse> => {
    const queryString = buildQueryString({ page, limit });
    return await api.request(`/conversations/${id}${queryString}`);
  },

 // Get conversations assigned to current user
   getAssignedConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    const queryString = buildQueryString(filters);
    const response = await api.request(`/conversations/assigned/me${queryString}`);
    
    return {
      ...response,
      conversations: response.conversations?.map((conv: any) => ({
        ...conv,
        assignedToUserId: conv.assignedToUserId || conv.assigned_to_user_id,
      })) || []
    };
  },


 // Get unassigned conversations
 getUnassignedConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    const queryString = buildQueryString(filters);
    const response = await api.request(`/conversations/unassigned${queryString}`);
    
    return {
      ...response,
      conversations: response.conversations?.map((conv: any) => ({
        ...conv,
        assignedToUserId: conv.assignedToUserId || conv.assigned_to_user_id,
      })) || []
    };
  },

  getAllConversations: async (filters: ConversationFilters = {}): Promise<ConversationsResponse> => {
    return conversationsApi.getConversations(filters);
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
sendMessage: async (conversationId: string, data: { message: string; attachments?: any[] }) => {
  // Create clean attachments
  const cleanAttachments = (data.attachments || []).map((att, index) => {
    const cleanAttachment: any = {
      id: String(att?.id || `attachment-${index}`),
      secureUrl: String(att?.secureUrl || att?.url || ''),
      url: String(att?.secureUrl || att?.url || ''),
      mimeType: String(att?.mimeType || ''),
    };
    
    if (att?.originalFilename) cleanAttachment.originalFilename = String(att.originalFilename);
    if (att?.filename) cleanAttachment.filename = String(att.filename);
    if (att?.fileSize) cleanAttachment.fileSize = Number(att.fileSize);
    if (att?.width) cleanAttachment.width = Number(att.width);
    if (att?.height) cleanAttachment.height = Number(att.height);
    if (att?.duration) cleanAttachment.duration = Number(att.duration);
    if (att?.caption) cleanAttachment.caption = String(att.caption);
    
    return cleanAttachment;
  });

  console.log('📤 Sending via conversationsApi.sendMessage:', {
    conversationId,
    message: data.message,
    attachmentsCount: cleanAttachments.length
  });

  // ✅ USE API CLIENT
  return await api.request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      message: data.message.trim(),
      attachments: cleanAttachments
    }),
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
    mutationFn: async ({
      conversationId,
      message,
      attachments = []
    }: {
      conversationId: string;
      message: string;
      attachments?: any[];
    }) => {
      // Create a clean, serializable attachments array
      const cleanAttachments = attachments.map((att, index) => {
        const cleanAttachment: any = {
          // Required fields
          id: String(att?.id || `attachment-${index}`),
          secureUrl: String(att?.secureUrl || att?.url || ''),
          url: String(att?.secureUrl || att?.url || ''),
          mimeType: String(att?.mimeType || ''),
        };
        
        // Optional fields - only include if they exist and are not undefined
        if (att?.originalFilename) cleanAttachment.originalFilename = String(att.originalFilename);
        if (att?.filename) cleanAttachment.filename = String(att.filename);
        if (att?.fileSize) cleanAttachment.fileSize = Number(att.fileSize);
        if (att?.width) cleanAttachment.width = Number(att.width);
        if (att?.height) cleanAttachment.height = Number(att.height);
        if (att?.duration) cleanAttachment.duration = Number(att.duration);
        if (att?.caption) cleanAttachment.caption = String(att.caption);
        
        return cleanAttachment;
      });

      console.log('📤 Sending message via API client:', {
        conversationId,
        message,
        attachmentsCount: cleanAttachments.length,
        firstAttachment: cleanAttachments[0] ? {
          id: cleanAttachments[0].id,
          hasSecureUrl: !!cleanAttachments[0].secureUrl,
          secureUrl: cleanAttachments[0].secureUrl?.substring(0, 50) + '...',
          mimeType: cleanAttachments[0].mimeType,
        } : null
      });

      // Log the actual JSON being sent
      const requestBody = {
        message: message.trim(),
        attachments: cleanAttachments
      };
      
      console.log('📤 Request body JSON:', JSON.stringify(requestBody, null, 2));

      // ✅ USE YOUR API CLIENT INSTEAD OF DIRECT FETCH
      try {
        const response = await api.request(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        
        console.log('✅ API client response:', response);
        return response;
      } catch (error: any) {
        console.error('❌ API client error:', error);
        throw new Error(error.message || 'Failed to send message');
      }
    },
    onSuccess: (data, variables) => {
      console.log('✅ Message sent successfully:', {
        conversationId: variables.conversationId,
        response: data
      });
      
      // Invalidate and refetch conversation messages
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
    onMutate: async (variables) => {
      console.log('🔄 Mutating - sending message:', {
        conversationId: variables.conversationId,
        message: variables.message,
        attachmentsCount: variables.attachments?.length || 0
      });
      
      // Optimistic update - add the message to the cache immediately
      const previousConversation = queryClient.getQueryData(['conversation', variables.conversationId]);
      
      if (previousConversation) {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          conversationId: variables.conversationId,
          contactId: (previousConversation as any)?.contact?.id,
          direction: 'outgoing',
          messageType: variables.attachments?.length ? 'image' : 'text',
          body: variables.message,
          status: 'sending',
          timestamp: new Date().toISOString(),
          metadata: variables.attachments?.length ? {
            mediaAttachmentId: variables.attachments[0]?.id,
            secureUrl: variables.attachments[0]?.secureUrl,
            originalFilename: variables.attachments[0]?.originalFilename,
            mimeType: variables.attachments[0]?.mimeType,
          } : {},
          createdAt: new Date().toISOString(),
        };
        
        queryClient.setQueryData(['conversation', variables.conversationId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...(old.messages || []), optimisticMessage],
            conversation: {
              ...old.conversation,
              lastMessage: variables.message || (variables.attachments?.length ? `[${variables.attachments.length} media]` : ''),
              lastMessageAt: new Date().toISOString(),
            }
          };
        });
      }
      
      return { previousConversation };
    },
    onSettled: (data, error, variables) => {
      // If there was an error, revert the optimistic update
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      }
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