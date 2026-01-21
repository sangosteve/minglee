// backend/src/services/meta-template.service.ts - COMPLETE
import axios from 'axios';
import FormData from 'form-data';

// Types matching Meta's API
export interface MetaCreateTemplateData {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: any[];
  allow_category_change?: boolean;
}

export interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: any[];
  quality_rating?: string;
}

export interface MetaTemplateResponse {
  success: boolean;
  data?: {
    id: string;
    status: string;
    category: string;
  };
  error?: string;
  code?: number;
  fbtrace_id?: string;
}

export interface MetaTemplatesResponse {
  success: boolean;
  data?: MetaTemplate[];
  error?: string;
}

export interface MetaTemplateStatusResponse {
  success: boolean;
  status?: string;
  quality_rating?: string;
  review_feedback?: string;
  error?: string;
}

export interface MetaMediaUploadResponse {
  success: boolean;
  mediaId?: string;
  error?: string;
}

export class MetaTemplateService {
  /**
   * Upload media to Meta's servers and get a Media ID
   * REQUIRED for IMAGE/VIDEO/DOCUMENT headers in templates
   */
static async uploadMediaToMeta(
  phoneNumberId: string,  // Phone Number ID for upload
  accessToken: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'document',
  fileName?: string
): Promise<MetaMediaUploadResponse> {
  try {
    console.log(`📤 [uploadMediaToMeta] Uploading ${mediaType} using Phone Number ID: ${phoneNumberId}`);
    
    // Download file
    const downloadResponse = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    
    const fileBuffer = Buffer.from(downloadResponse.data);
    
    // Create FormData
    const FormData = require('form-data');
    const formData = new FormData();
    
    const finalFileName = fileName || mediaUrl.split('/').pop() || `file.${this.getFileExtension(mediaType)}`;
    const mimeType = downloadResponse.headers['content-type'] || this.getMimeType(mediaType, finalFileName);
    
    // Append with correct parameters
    formData.append('file', fileBuffer, {
      filename: finalFileName,
      contentType: mimeType,
      knownLength: fileBuffer.length,
    });
    
    // CRITICAL: Use 'WHATSAPP' (uppercase) for template media
    formData.append('messaging_product', 'WHATSAPP');  // Uppercase
    formData.append('type', mediaType.toUpperCase());   // Uppercase
    
    // Upload to Phone Number ID endpoint
    const uploadUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;
    
    const formHeaders = formData.getHeaders();
    
    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formHeaders,
      },
      timeout: 120000,
    });
    
    const mediaId = uploadResponse.data.id;
    console.log(`✅ Media uploaded! ID: ${mediaId}`);
    
    return {
      success: true,
      mediaId,
    };
    
  } catch (error: any) {
    console.error('❌ [uploadMediaToMeta] Failed:', error.response?.data?.error || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

  /**
   * Get MIME type based on file extension or media type
   */
  private static getMimeType(mediaType: string, fileName?: string): string {
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'gif':
          return 'image/gif';
        case 'mp4':
          return 'video/mp4';
        case 'avi':
          return 'video/x-msvideo';
        case 'mov':
          return 'video/quicktime';
        case 'pdf':
          return 'application/pdf';
        case 'doc':
          return 'application/msword';
        case 'docx':
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'txt':
          return 'text/plain';
      }
    }
    
    // Fallback based on media type
    switch (mediaType) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get file extension based on media type
   */
  private static getFileExtension(mediaType: string): string {
    switch (mediaType) {
      case 'image':
        return 'jpg';
      case 'video':
        return 'mp4';
      case 'document':
        return 'pdf';
      default:
        return 'bin';
    }
  }

  /**
   * Check if a string is a Meta Media ID (numeric ID)
   */
  private static isMetaMediaId(value: string): boolean {
    // Meta Media IDs are numeric strings
    return /^\d+$/.test(value) && value.length >= 15 && value.length <= 20;
  }

  /**
   * Check if a string is a URL
   */
  private static isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a template in Meta's WhatsApp Business API
   * Handles media upload automatically for IMAGE/VIDEO/DOCUMENT headers
   */
  static async createTemplate(
    businessId: string,
    accessToken: string,
    payload: MetaCreateTemplateData,
    phoneNumberId?: string
  ): Promise<MetaTemplateResponse> {
    try {
      const url = `https://graph.facebook.com/v20.0/${businessId}/message_templates`;
      
      console.log('🚨 [createTemplate] Starting template creation...');
      console.log('📝 Original payload:', JSON.stringify(payload, null, 2));
      
      // Process components to handle media uploads
      const processedComponents = [];
      
      for (const comp of payload.components) {
        if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          console.log(`🔍 Processing ${comp.format} header...`);
          
          const mediaUrl = comp.example?.header_handle?.[0];
          
          if (!mediaUrl) {
            console.error(`❌ ${comp.format} header missing media URL`);
            throw new Error(`${comp.format} header requires a media URL`);
          }
          
          // Check if it's already a Meta Media ID
          if (this.isMetaMediaId(mediaUrl)) {
            console.log(`✅ Already a Meta Media ID: ${mediaUrl}`);
            processedComponents.push(comp);
            continue;
          }
          
          // Check if it's a URL that needs upload
          if (this.isUrl(mediaUrl)) {
            if (!phoneNumberId) {
              console.error(`❌ Need phoneNumberId to upload media`);
              throw new Error('Phone Number ID required for media upload');
            }
            
            console.log(`📤 Uploading ${comp.format.toLowerCase()} to Meta: ${mediaUrl}`);
            
            const mediaType = comp.format.toLowerCase() as 'image' | 'video' | 'document';
            const uploadResult = await this.uploadMediaToMeta(
              phoneNumberId,
              accessToken,
              mediaUrl,
              mediaType
            );
            
            if (!uploadResult.success || !uploadResult.mediaId) {
              console.error(`❌ Failed to upload media: ${uploadResult.error}`);
              throw new Error(`Failed to upload ${comp.format}: ${uploadResult.error}`);
            }
            
            console.log(`✅ Got Meta Media ID: ${uploadResult.mediaId}`);
            
            // Replace URL with Meta Media ID
            processedComponents.push({
              ...comp,
              example: {
                header_handle: [uploadResult.mediaId]
              }
            });
          } else {
            console.error(`❌ Invalid media reference: ${mediaUrl}`);
            throw new Error(`Invalid media reference for ${comp.format} header`);
          }
        } else {
          // Non-media component, pass through as-is
          processedComponents.push(comp);
        }
      }
      
      // Create final payload
      const finalPayload = {
        name: payload.name,
        category: payload.category,
        language: payload.language,
        components: processedComponents,
        allow_category_change: payload.allow_category_change ?? true,
      };
      
      console.log('🚨 [createTemplate] FINAL PAYLOAD with Meta Media IDs:');
      console.log(JSON.stringify(finalPayload, null, 2));
      
      // Verify media headers have Media IDs
      finalPayload.components.forEach((comp, idx) => {
        if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          const mediaId = comp.example?.header_handle?.[0];
          if (!this.isMetaMediaId(mediaId)) {
            console.error(`❌ Component ${idx} still has invalid media: ${mediaId}`);
            throw new Error(`${comp.format} header requires Meta Media ID, got: ${mediaId}`);
          }
        }
      });
      
      console.log(`📡 Calling Meta API: ${url}`);
      
      const response = await axios.post(
        url,
        finalPayload, // ✅ Direct JSON body, no manual stringification
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout
        }
      );

      console.log('✅ [createTemplate] Meta API Success:', {
        status: response.status,
        data: response.data,
      });

      return {
        success: true,
        data: {
          id: response.data.id,
          status: response.data.status,
          category: response.data.category,
        },
      };

    } catch (error: any) {
      console.error('❌ [createTemplate] Meta API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        requestData: error.config?.data ? JSON.parse(error.config.data) : null,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        errorMessage: error.message,
      });

      const metaError = error.response?.data?.error;
      
      return {
        success: false,
        error: metaError?.message || error.message || 'Meta API error',
        code: metaError?.code || error.response?.status,
        fbtrace_id: metaError?.fbtrace_id,
      };
    }
  }

  /**
   * Get all templates from Meta API
   */
  static async getAllTemplates(
    businessId: string,
    accessToken: string,
    options: {
      fields?: string[];
      status?: 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
      limit?: number;
    } = {}
  ): Promise<MetaTemplatesResponse> {
    try {
      const url = `https://graph.facebook.com/v20.0/${businessId}/message_templates`;
      
      const params = new URLSearchParams();
      if (options.fields) {
        params.append('fields', options.fields.join(','));
      } else {
        params.append('fields', 'id,name,category,language,status,components,quality_rating');
      }
      
      if (options.status) {
        params.append('status', options.status);
      }
      
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }

      console.log(`📡 [getAllTemplates] Calling: ${url}?${params.toString()}`);
      
      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });

      console.log(`✅ [getAllTemplates] Found ${response.data.data?.length || 0} templates`);

      return {
        success: true,
        data: response.data.data,
      };

    } catch (error: any) {
      console.error('❌ [getAllTemplates] Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to fetch templates',
      };
    }
  }

  /**
   * Get template status from Meta
   */
  static async getTemplateStatus(
    templateId: string,
    accessToken: string
  ): Promise<MetaTemplateStatusResponse> {
    try {
      const url = `https://graph.facebook.com/v20.0/${templateId}`;
      
      const params = new URLSearchParams();
      params.append('fields', 'id,status,quality_rating,review_feedback');

      console.log(`📡 [getTemplateStatus] Calling: ${url}`);
      
      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });

      console.log('✅ [getTemplateStatus] Success:', response.data);

      return {
        success: true,
        status: response.data.status,
        quality_rating: response.data.quality_rating,
        review_feedback: response.data.review_feedback,
      };

    } catch (error: any) {
      console.error('❌ [getTemplateStatus] Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to get template status',
      };
    }
  }

  /**
   * Delete template from Meta
   */
  static async deleteTemplate(
    businessId: string,
    accessToken: string,
    templateName: string,
    templateId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v20.0/${templateId}`;
      
      console.log(`🗑️  [deleteTemplate] Deleting: ${templateName} (${templateId})`);
      
      const response = await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });

      console.log('✅ [deleteTemplate] Success:', response.data);

      return {
        success: true,
      };

    } catch (error: any) {
      console.error('❌ [deleteTemplate] Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to delete template',
      };
    }
  }

  /**
   * Update template in Meta
   */
  static async updateTemplate(
    businessId: string,
    accessToken: string,
    templateId: string,
    data: Partial<MetaCreateTemplateData>,
    phoneNumberId?: string
  ): Promise<MetaTemplateResponse> {
    try {
      const url = `https://graph.facebook.com/v20.0/${templateId}`;
      
      console.log('🚨 [updateTemplate] Starting template update...');
      
      // Process media uploads if needed
      let processedData = data;
      if (data.components && phoneNumberId) {
        const processedComponents = [];
        
        for (const comp of data.components) {
          if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
            const mediaUrl = comp.example?.header_handle?.[0];
            
            if (mediaUrl && this.isUrl(mediaUrl) && !this.isMetaMediaId(mediaUrl)) {
              console.log(`📤 Uploading media for update: ${mediaUrl}`);
              
              const mediaType = comp.format.toLowerCase() as 'image' | 'video' | 'document';
              const uploadResult = await this.uploadMediaToMeta(
                phoneNumberId,
                accessToken,
                mediaUrl,
                mediaType
              );
              
              if (uploadResult.success && uploadResult.mediaId) {
                processedComponents.push({
                  ...comp,
                  example: {
                    header_handle: [uploadResult.mediaId]
                  }
                });
                continue;
              }
            }
          }
          processedComponents.push(comp);
        }
        
        processedData = {
          ...data,
          components: processedComponents,
        };
      }
      
      console.log('🚨 [updateTemplate] Final update payload:', JSON.stringify(processedData, null, 2));
      
      const response = await axios.post(
        url,
        processedData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      console.log('✅ [updateTemplate] Success:', response.data);

      return {
        success: true,
        data: {
          id: response.data.id,
          status: response.data.status,
          category: response.data.category,
        },
      };

    } catch (error: any) {
      console.error('❌ [updateTemplate] Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to update template',
        code: error.response?.data?.error?.code,
      };
    }
  }
}