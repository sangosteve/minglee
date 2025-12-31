// frontend/src/lib/api/tags.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Tag {
  id: string;
  name: string;
  description: string;
  color: string;
  count: number;
  conversationCount: number;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTagDto {
  name?: string;
  description?: string;
  color?: string;
}

export interface TaggedItemsResponse {
  tag: Tag;
  conversations: any[];
  contacts: any[];
}

export interface TagsApiResponse {
  success: boolean;
  tags: Tag[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export const tagsApi = {
  // Get all tags
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<Tag[]> => {
    try {
      const response = await api.get('/tags', { params });
      console.log('Tags API getAll response:', response);
      
      if (response && response.success === true) {
        return response.tags || [];
      }
      
      throw new Error(response?.error || 'Failed to fetch tags');
      
    } catch (error: any) {
      console.error('Failed to fetch tags:', error);
      throw new Error('Failed to fetch tags: ' + error.message);
    }
  },

  // Create new tag
  create: async (data: CreateTagDto): Promise<Tag> => {
    try {
      console.log('Creating tag with data:', data);
      const response = await api.post('/tags', data);
      console.log('Create tag response:', response);

      if (response && response.success === true) {
        return response.tag;
      }
      
      throw new Error(response?.error || 'Failed to create tag');
      
    } catch (error: any) {
      console.error('Failed to create tag:', error);
      throw new Error('Failed to create tag: ' + error.message);
    }
  },

  // Update tag
  update: async (id: string, data: UpdateTagDto): Promise<Tag> => {
    try {
      const response = await api.put(`/tags/${id}`, data);
      
      if (response && response.success === true) {
        return response.tag;
      }
      
      throw new Error(response?.error || 'Failed to update tag');
      
    } catch (error: any) {
      console.error('Failed to update tag:', error);
      throw new Error('Failed to update tag: ' + error.message);
    }
  },

  // Delete tag
  delete: async (id: string): Promise<void> => {
    try {
      const response = await api.delete(`/tags/${id}`);
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to delete tag');
      }
      
      // Success
      return;
      
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
      throw new Error('Failed to delete tag: ' + error.message);
    }
  },

  // Get items by tag
  getTaggedItems: async (
    tagId: string, 
    type: 'all' | 'conversations' | 'contacts' = 'all'
  ): Promise<TaggedItemsResponse> => {
    try {
      const response = await api.get(`/tags/${tagId}/items?type=${type}`);
      
      if (response && response.success === true) {
        return response.data || response;
      }
      
      throw new Error(response?.error || 'Failed to get tagged items');
      
    } catch (error: any) {
      console.error('Failed to get tagged items:', error);
      throw new Error('Failed to get tagged items: ' + error.message);
    }
  },

  // Debug endpoint
  debug: async (): Promise<any> => {
    try {
      const response = await api.get('/tags/debug/all');
      return response;
    } catch (error) {
      console.error('Debug error:', error);
      throw error;
    }
  },
};

// React Query hooks
export const useTags = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}) => {
  return useQuery({
    queryKey: ['tags', params],
    queryFn: () => tagsApi.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create tag:', error);
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagDto }) => 
      tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

export const useTaggedItems = (
  tagId: string, 
  type: 'all' | 'conversations' | 'contacts' = 'all'
) => {
  return useQuery({
    queryKey: ['tagged-items', tagId, type],
    queryFn: () => tagsApi.getTaggedItems(tagId, type),
    enabled: !!tagId,
  });
};

// Utility function to transform tags for select components
export const transformTagsForSelect = (tags: Tag[]) => {
  return tags.map(tag => ({
    id: tag.id,
    label: tag.name,
    color: tag.color,
    description: tag.description,
  }));
};