
//frontend/src/lib/api/media.ts
import { useAuthStore } from '@/stores/auth.store';
import { api } from '../api';

export interface MediaAttachment {
  id: string;
  publicId: string;
  cloudinaryUrl: string;
  secureUrl: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  assetType: string;
  resourceType: string;
  caption?: string;
  tags: string[];
  transformation?: {
    thumbnail: string;
    responsive: Array<{ width: number; height: number; url: string }>;
  };
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    total: number;
    successful: number;
    failed: number;
    uploads: Array<{
      originalname: string;
      success: boolean;
      url: string;
      publicId: string;
      id?: string;
      error?: string;
    }>;
  };
}

export interface MediaListResponse {
  success: boolean;
  data: {
    attachments: MediaAttachment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface UploadSignatureResponse {
  success: boolean;
  data: {
    cloudName: string;
    apiKey: string;
    uploadPreset?: string;
    signature: string;
    timestamp: number;
    folder: string;
    tags: string;
  };
}

export const mediaApi = {
  // Upload single file
  uploadFile: async (file: File, folder?: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
      formData.append('folder', folder);
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/media/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  // Upload multiple files
  uploadMultipleFiles: async (files: File[], folder?: string): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    if (folder) {
      formData.append('folder', folder);
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/media/upload-multiple`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  // Get upload signature for direct upload
  getUploadSignature: async (): Promise<UploadSignatureResponse> => {
    return api.get<UploadSignatureResponse>('/media/upload-signature');
  },

  // Get user's attachments
  getAttachments: async (params?: { 
    page?: number; 
    limit?: number; 
    type?: string;
  }): Promise<MediaListResponse> => {
    return api.get<MediaListResponse>('/media/attachments', params);
  },

  // Delete attachment
  deleteAttachment: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/media/attachments/${id}`);
  },

  // Helper: Upload files and return media IDs
  uploadFilesAndGetIds: async (files: File[], userId: string): Promise<string[]> => {
    try {
      const response = await mediaApi.uploadMultipleFiles(files, `quick-replies/user_${userId}`);
      
      if (response.success && response.data.uploads) {
        // Filter successful uploads and extract IDs
        return response.data.uploads
          .filter(upload => upload.success && upload.id)
          .map(upload => upload.id as string);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to upload files:', error);
      throw new Error('File upload failed');
    }
  },
};

// Helper function to get current user ID
export const getCurrentUserId = (): string | null => {
  const { user } = useAuthStore.getState();
  return user?.id || null;
};