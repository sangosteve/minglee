// frontend/src/lib/api/tags.ts
import { api } from '../api';

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

export const tagsApi = {
  // Get all tags
  getAll: async (): Promise<Tag[]> => {
    const response = await api.get('/tags');
    return response.tag;
  },

  // Create new tag
  create: async (data: CreateTagDto): Promise<Tag> => {
    const response = await api.post('/tags', data);

    console.log('Created tag response:', response);
    return response.tag;
  },

  // Update tag
  update: async (id: string, data: UpdateTagDto): Promise<Tag> => {
    const response = await api.put(`/tags/${id}`, data);
    return response.tag;
  },

  // Delete tag
  delete: async (id: string): Promise<void> => {
    await api.delete(`/tags/${id}`);
  },

  // Get items by tag
  getTaggedItems: async (
    tagId: string, 
    type: 'all' | 'conversations' | 'contacts' = 'all'
  ): Promise<TaggedItemsResponse> => {
    const response = await api.get(`/tags/${tagId}/items?type=${type}`);
    return response.tag;
  },
};