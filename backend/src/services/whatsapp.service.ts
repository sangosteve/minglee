// backend/src/services/whatsapp.service.ts
import axios from 'axios';

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  video?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  audio?: {
    mime_type: string;
    sha256: string;
    id: string;
    voice?: boolean;
  };
  document?: {
    caption?: string;
    filename: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  sticker?: {
    mime_type: string;
    sha256: string;
    id: string;
    animated?: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: any[];
  interactive?: any;
  button?: any;
}


export interface WhatsAppWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface MediaDownloadOptions {
  responseType?: 'arraybuffer' | 'stream';
  timeout?: number;
  maxContentLength?: number;
}

export class WhatsAppService {
  private static apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  private static baseUrl = `https://graph.facebook.com/${this.apiVersion}`;


  /**
   * Download media from WhatsApp
   */
  static async downloadMedia(
    mediaId: string,
    accessToken: string,
    options: MediaDownloadOptions = {}
  ): Promise<Buffer | null> {
    try {
      // First get the media URL
      const mediaUrl = await this.getMediaUrl(mediaId, accessToken);
      if (!mediaUrl) {
        throw new Error('Failed to get media URL');
      }

      console.log(`📥 Downloading media from: ${mediaUrl.substring(0, 100)}...`);

      const response = await axios.get(mediaUrl, {
        responseType: options.responseType || 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: options.timeout || 60000, // 60 seconds default
        maxContentLength: options.maxContentLength || 100 * 1024 * 1024, // 100MB default
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('❌ Error downloading media:', {
        mediaId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get media metadata
   */
  static async getMediaMetadata(
    mediaId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Error getting media metadata:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Generic send message method
   */
  static async sendMessage(
    phoneNumberId: string,
    payload: any,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds
        }
      );

      console.log(`✅ WhatsApp message sent:`, {
        to: payload.to,
        type: payload.type,
        messageId: response.data?.messages?.[0]?.id,
      });

      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data?.error || {};
      console.error('❌ Error sending WhatsApp message:', {
        error: errorData.message || error.message,
        code: errorData.code,
        type: errorData.type,
        payload: {
          to: payload.to,
          type: payload.type,
        },
      });
      throw error;
    }
  }

  /**
   * Send Interactive Message
   */
static async sendInteractiveMessage(
  phoneNumberId: string,
  to: string,
  interactiveData: any,
  accessToken: string
): Promise<any> {
  try {
    const url = `${this.baseUrl}/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "interactive",
      interactive: interactiveData
    };
    
    console.log('📋 Sending interactive message payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
    
    console.log('✅ Interactive message sent successfully:', {
      messageId: response.data?.messages?.[0]?.id,
    });
    
    return response.data;
  } catch (error: any) {
    const errorData = error.response?.data?.error || {};
    console.error('❌ Error sending interactive message:', {
      error: errorData.message || error.message,
      code: errorData.code,
      type: errorData.type,
      details: errorData.error_data?.details,
      interactiveData: interactiveData,
    });
    
    // Log the full response for debugging
    if (error.response?.data) {
      console.error('❌ WhatsApp API error response:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

  /**
   * Send a media message
   */
  static async sendMediaMessage(
    phoneNumberId: string,
    to: string,
    cloudinaryUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    filename?: string,
    accessToken: string
  ): Promise<any> {
    try {
      let payload: any;

      switch (mediaType) {
        case 'image':
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'image',
            image: {
              link: cloudinaryUrl,
              caption: caption?.substring(0, 3000),
            },
          };
          break;

        case 'video':
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'video',
            video: {
              link: cloudinaryUrl,
              caption: caption?.substring(0, 3000),
            },
          };
          break;

        case 'audio':
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'audio',
            audio: {
              link: cloudinaryUrl,
            },
          };
          break;

        case 'document':
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'document',
            document: {
              link: cloudinaryUrl,
              caption: caption?.substring(0, 3000),
              filename: filename?.substring(0, 240) || caption?.substring(0, 240) || 'document',
            },
          };
          break;

        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      console.log(`📤 Sending ${mediaType} via WhatsApp using Cloudinary URL`);
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log(`✅ WhatsApp media message sent successfully`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error sending WhatsApp media message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a text message
   */
  static async sendTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            body: text,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Error sending WhatsApp text message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get media URL from WhatsApp API (for incoming messages)
   */
  static async getMediaUrl(
    mediaId: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.data?.url || null;
    } catch (error: any) {
      console.error('❌ Error getting media URL:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Mark a message as read
   */
  static async markAsRead(
    phoneNumberId: string,
    messageId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error marking message as read:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
 

  /**
   * Mark a message as delivered
   */
  static async markAsDelivered(
    phoneNumberId: string,
    messageId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'delivered',
          message_id: messageId,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error marking message as delivered:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get message template list
   */
  static async getTemplates(
    businessAccountId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching templates:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send template message
   */
  static async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components: any[] = [],
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error sending template message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get business profile
   */
  static async getBusinessProfile(
    phoneNumberId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${phoneNumberId}/whatsapp_business_profile`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching business profile:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update business profile
   */
  static async updateBusinessProfile(
    phoneNumberId: string,
    profileData: any,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/whatsapp_business_profile`,
        profileData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error updating business profile:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Validate webhook signature (for security)
   */
  static validateWebhookSignature(payload: any, signature: string): boolean {
    // Implement signature validation if needed
    // WhatsApp Cloud API uses X-Hub-Signature-256 header
    // For production, implement proper signature validation
    // using the app secret from WhatsApp Business API
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    
    if (!appSecret || !signature) {
      console.warn('⚠️ Webhook signature validation skipped: missing app secret or signature');
      return true; // Skip validation in development
    }
    
    // In production, you should implement proper HMAC validation
    // const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return expectedSignature === signature;
    
    return true; // For now, return true. Implement proper validation in production
  }

  /**
   * Handle rate limiting
   */
  private static handleRateLimit(headers: any): void {
    const rateLimitRemaining = headers['x-business-use-case-usage'] || headers['x-app-usage'];
    if (rateLimitRemaining) {
      console.log(`⚠️ WhatsApp API rate limit:`, rateLimitRemaining);
      
      // Parse rate limit information
      try {
        const usage = JSON.parse(rateLimitRemaining);
        console.log(`📊 WhatsApp API usage:`, usage);
        
        // Check if we're approaching limits
        if (usage?.call_count > 80) { // 80% of limit
          console.warn('🚨 Approaching WhatsApp API rate limit');
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }

  /**
   * Get message by ID (for debugging)
   */
  static async getMessage(
    messageId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send location message
   */
  static async sendLocationMessage(
    phoneNumberId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
    accessToken: string
  ): Promise<any> {
    try {
      return await this.sendMessage(phoneNumberId, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'location',
        location: {
          latitude,
          longitude,
          name: name?.substring(0, 100),
          address: address?.substring(0, 100),
        },
      }, accessToken);
    } catch (error: any) {
      console.error('❌ Error sending location message:', error.message);
      throw error;
    }
  }

  /**
   * Send contact message
   */
  static async sendContactMessage(
    phoneNumberId: string,
    to: string,
    contacts: any[],
    accessToken: string
  ): Promise<any> {
    try {
      return await this.sendMessage(phoneNumberId, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'contacts',
        contacts,
      }, accessToken);
    } catch (error: any) {
      console.error('❌ Error sending contact message:', error.message);
      throw error;
    }
  }

  /**
   * Check WhatsApp number validity
   */
  static async checkNumberValidity(
    phoneNumberId: string,
    phoneNumber: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${phoneNumberId}/contacts`,
        {
          blocking: 'wait',
          contacts: [phoneNumber],
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error checking number validity:', error.response?.data || error.message);
      throw error;
    }
  }
}