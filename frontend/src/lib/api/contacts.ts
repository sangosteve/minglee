// frontend/src/lib/api/contacts.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Tag {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  note?: string;
  status: 'active' | 'inactive' | 'lead' | 'customer' | 'blocked' | 'archived';
  source?: string;
  tagIds: string[];
  tags: Tag[];
  isActive: boolean;
  optIn: boolean;
  lastContactedAt?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ContactFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tags?: string[];
  city?: string;
  country?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ContactsResponse {
  success: boolean;
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ContactAnalytics {
  // Backwards-compatible fields used by UI
  total?: number;
  totalContacts?: number;
  byStatus: Array<{ status: string; count: number }>;
  byTag: Array<{ tag: string; tagId: string; count: number; color?: string }>;
  // Support both month and week nomenclature
  newThisMonth?: number;
  newThisWeek?: number;
}

// API Calls
export const contactsApi = {
  // Get contacts with filters
  getContacts: async (filters: ContactFilters = {}): Promise<ContactsResponse> => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.tags) {
      if (Array.isArray(filters.tags)) {
        filters.tags.forEach(tag => params.append('tags', tag));
      } else {
        params.append('tags', filters.tags);
      }
    }
    if (filters.city) params.append('city', filters.city);
    if (filters.country) params.append('country', filters.country);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    const queryString = params.toString();
    return await api.get(`/contacts${queryString ? `?${queryString}` : ''}`);
  },

  // Get contact by ID
  getContact: async (id: string): Promise<{ success: boolean; contact: Contact }> => {
    return await api.get(`/contacts/${id}`);
  },

  // Create contact
  createContact: async (data: {
    name: string;
    phone: string;
    email?: string;
    city?: string;
    state?: string;
    country?: string;
    status?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    note?: string;
  }): Promise<{ success: boolean; contact: Contact }> => {
    return await api.post('/contacts', data);
  },

  // Update contact
  updateContact: async (id: string, updates: Partial<{
    name: string;
    phone: string;
    email?: string;
    city?: string;
    state?: string;
    country?: string;
    status?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    note?: string;
    isActive?: boolean;
    optIn?: boolean;
  }>): Promise<{ success: boolean; contact: Contact }> => {
    return await api.put(`/contacts/${id}`, updates);
  },

  // Update contact status
  updateStatus: async (id: string, status: string): Promise<{ success: boolean; contact: Contact }> => {
    return await api.patch(`/contacts/${id}/status`, { status });
  },

  // Delete contact
  deleteContact: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.delete(`/contacts/${id}`);
  },

  // Add tags to contact
  addTags: async (id: string, tags: string[]): Promise<{ success: boolean; contact: Contact }> => {
    return await api.post(`/contacts/${id}/tags`, { tags });
  },

  // Remove tags from contact
  removeTags: async (id: string, tags: string[]): Promise<{ success: boolean; contact: Contact }> => {
    return await api.delete(`/contacts/${id}/tags`, { tags });
  },

  // Get analytics (prefer new analytics routes, fallback to old)
  getAnalytics: async (): Promise<{ success: boolean; analytics: ContactAnalytics }> => {
    const defaultAnalytics: { success: boolean; analytics: ContactAnalytics } = {
      success: true,
      analytics: {
        total: 0,
        totalContacts: 0,
        byStatus: [],
        byTag: [],
        newThisMonth: 0,
        newThisWeek: 0,
      },
    };

    // Helper to normalize server response into the UI-friendly shape
    function normalize(resp: any) {
      const a = resp.analytics || {};
      return {
        total: a.total ?? a.totalContacts ?? 0,
        totalContacts: a.total ?? a.totalContacts ?? 0,
        byStatus: a.byStatus ?? [],
        byTag: a.byTag ?? [],
        newThisMonth: a.newThisMonth ?? a.newThisWeek ?? 0,
        newThisWeek: a.newThisWeek ?? a.newThisMonth ?? 0,
      } as ContactAnalytics;
    }

    try {
      // Prefer new endpoint
      const resp = await api.get('/analytics/contacts/overview');
      return { success: true, analytics: normalize(resp) };
    } catch (err) {
      try {
        // Fallback to old endpoint
        const resp = await api.get('/contacts/analytics/overview');
        return { success: true, analytics: normalize(resp) };
      } catch (e) {
        // Return default so UI doesn't break
        return defaultAnalytics;
      }
    }
  },
};

// React Query Hooks
export const useContacts = (filters: ContactFilters = {}) => {
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => contactsApi.getContacts(filters),
    select: (data) => data,
    staleTime: 1000 * 60 * 5,
  });
};

export const useContact = (id: string) => {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.getContact(id),
    select: (data) => data.contact,
    enabled: !!id,
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: contactsApi.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) =>
      contactsApi.updateContact(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: contactsApi.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
    },
  });
};

export const useUpdateContactStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      contactsApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
    },
  });
};

export const useContactAnalytics = () => {
  return useQuery({
    queryKey: ['contact-analytics'],
    queryFn: () => contactsApi.getAnalytics(),
    select: (data) => data.analytics,
    staleTime: 1000 * 60 * 10,
  });
};