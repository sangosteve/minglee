import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quickRepliesApi } from '@/lib/api/quick-replies';
import type { 
  QuickReply, 
  CreateQuickReplyData, 
  UpdateQuickReplyData,
  QuickReplyFilters 
} from '@/lib/api/quick-replies';

// React Query hooks
export const useQuickReplies = (filters: QuickReplyFilters = {}) => {
  return useQuery({
    queryKey: ['quickReplies', filters],
    queryFn: () => quickRepliesApi.getQuickReplies(filters),
    select: (data) => data,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useQuickReply = (id: string) => {
  return useQuery({
    queryKey: ['quickReply', id],
    queryFn: () => quickRepliesApi.getQuickReply(id),
    select: (data) => data.quickReply,
    enabled: !!id,
  });
};

export const useCreateQuickReply = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: quickRepliesApi.createQuickReply,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
      return data.quickReply;
    },
  });
};

export const useUpdateQuickReply = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuickReplyData }) =>
      quickRepliesApi.updateQuickReply(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
      queryClient.invalidateQueries({ queryKey: ['quickReply', variables.id] });
      return data.quickReply;
    },
  });
};

export const useDeleteQuickReply = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: quickRepliesApi.deleteQuickReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
    },
  });
};

export const useDuplicateQuickReply = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: quickRepliesApi.duplicateQuickReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
    },
  });
};

export const useUploadAttachments = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) =>
      quickRepliesApi.uploadAttachments(id, files),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quickReply', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
    },
  });
};

export const useTopics = () => {
  return useQuery({
    queryKey: ['quickReplyTopics'],
    queryFn: () => quickRepliesApi.getTopics(),
    select: (data) => data.topics,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};