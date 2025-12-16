// frontend/src/components/tags/TagsProvider.tsx
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagsApi, type Tag, type CreateTagDto, type UpdateTagDto } from '@/lib/api/tags';

// React Query keys
export const tagKeys = {
  all: ['tags'] as const,
  lists: () => [...tagKeys.all, 'list'] as const,
  list: (filters: any) => [...tagKeys.lists(), { filters }] as const,
  details: () => [...tagKeys.all, 'detail'] as const,
  detail: (id: string) => [...tagKeys.details(), id] as const,
};

// Custom hooks for tags
export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: tagsApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: (newTag) => {
      // Update the tags list cache
      queryClient.setQueryData<Tag[]>(tagKeys.all, (old = []) => {
        return [newTag, ...old];
      });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagDto }) =>
      tagsApi.update(id, data),
    onSuccess: (updatedTag) => {
      // Update the tags list cache
      queryClient.setQueryData<Tag[]>(tagKeys.all, (old = []) => {
        return old.map(tag => tag.id === updatedTag.id ? updatedTag : tag);
      });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: (_, tagId) => {
      // Remove the tag from the cache
      queryClient.setQueryData<Tag[]>(tagKeys.all, (old = []) => {
        return old.filter(tag => tag.id !== tagId);
      });
    },
  });
}

// Provider component
export function TagsProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}