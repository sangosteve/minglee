// frontend/src/lib/api/contacts.ts
import { api } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/types/contact';

// Types (same as before)
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
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  byTag: Array<{ tag: string; count: number }>;
  newThisMonth: number;
}

// Helper to build query string
const buildQueryString = (filters: ContactFilters = {}): string => {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.tags?.length) {
    filters.tags.forEach(tag => params.append('tags', tag));
  }
  if (filters.city) params.append('city', filters.city);
  if (filters.country) params.append('country', filters.country);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

// API Calls - Fixed to use your api.request() method
export const contactsApi = {
  // Get contacts with filters
  getContacts: async (filters: ContactFilters = {}): Promise<ContactsResponse> => {
    const queryString = buildQueryString(filters);
    return await api.request(`/contacts${queryString}`);
  },

  // Get contact by ID
  getContact: async (id: string): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request(`/contacts/${id}`);
  },

  // Create contact
  createContact: async (contact: Partial<Contact>): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  // Update contact
  updateContact: async (id: string, updates: Partial<Contact>): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete contact
  deleteContact: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await api.request(`/contacts/${id}`, {
      method: 'DELETE',
    });
  },

  // Update contact status
  updateStatus: async (id: string, status: string): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request(`/contacts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Add tags to contact
  addTags: async (id: string, tags: string[]): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request(`/contacts/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });
  },

  // Remove tags from contact
  removeTags: async (id: string, tags: string[]): Promise<{ success: boolean; contact: Contact }> => {
    return await api.request(`/contacts/${id}/tags`, {
      method: 'DELETE',
      body: JSON.stringify({ tags }),
    });
  },

  // Get analytics
  getAnalytics: async (): Promise<{ success: boolean; analytics: ContactAnalytics }> => {
    return await api.request('/contacts/analytics/overview');
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
      return data.contact;
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) =>
      contactsApi.updateContact(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
      return data.contact;
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['contact-analytics'] });
      return data.contact;
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