// frontend/src/hooks/use-template-media.ts
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

interface UploadMediaResponse {
  success: boolean;
  data?: {
    id: string;
    secureUrl: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
    duration?: number;
    publicId?: string;
  };
  error?: string;
}

export const useUploadTemplateMedia = () => {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadMediaResponse> => {
      const formData = new FormData();
      formData.append('files', file); // Note: 'files' not 'file' for upload-multiple endpoint
      formData.append('folder', 'template_media');

      const { accessToken } = useAuthStore.getState();
      
      if (!accessToken) {
        throw new Error('Please log in to upload files');
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const response = await fetch(`${API_URL}/media/upload-multiple`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Extract the first upload result
      const uploadResult = result.data?.uploads?.[0];
      
      if (!uploadResult?.success) {
        throw new Error(uploadResult?.error || 'Upload failed');
      }
      
      return {
        success: true,
        data: {
          id: uploadResult.id || `media_${Date.now()}`,
          secureUrl: uploadResult.secureUrl || uploadResult.url,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          publicId: uploadResult.publicId,
        }
      };
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error('Upload failed', {
        description: error.message || 'Failed to upload file'
      });
    },
  });
};