// backend/src/services/whatsapp-media.service.ts
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { getDb } from '../db/client';
import { mediaAttachments, messages, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { WhatsAppService } from './whatsapp.service';

export interface WhatsAppMediaInfo {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
  filename?: string;
}

export interface WhatsAppMediaDownloadResult {
  success: boolean;
  mediaAttachment?: any;
  error?: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  tags?: string[];
  context?: Record<string, string>;
  resource_type?: 'image' | 'video' | 'auto' | 'raw';
  transformation?: any[];
  overwrite?: boolean;
}

export class WhatsAppMediaService {
  private static apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  private static baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  
  /**
   * Process and store WhatsApp media (download from WhatsApp → upload to Cloudinary)
   */
static async processWhatsAppMedia(
  whatsappMediaId: string,
  mediaInfo: WhatsAppMediaInfo,
  userId: string,
  messageId?: string,
  accessToken?: string // Optional: can be passed from caller
): Promise<WhatsAppMediaDownloadResult> {
  try {
    const db = getDb();
    
    // 1. Get user's WhatsApp configuration
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const user = userResult[0];
    
    // Use provided access token or get from user
    const whatsappAccessToken = accessToken || user?.whatsappAccessToken;
    
    if (!whatsappAccessToken) {
      return {
        success: false,
        error: 'WhatsApp access token not found',
      };
    }

    // 2. Get media URL from WhatsApp API
    const mediaUrl = await WhatsAppService.getMediaUrl(
      whatsappMediaId,
      whatsappAccessToken
    );

    if (!mediaUrl) {
      return {
        success: false,
        error: 'Failed to get WhatsApp media URL',
      };
    }

    console.log(`📥 WhatsApp media URL obtained: ${mediaUrl.substring(0, 100)}...`);

    // 3. Configure Cloudinary
    this.configureCloudinary();
    
    // 4. Download and upload to Cloudinary
    console.log(`📥 Downloading media from WhatsApp...`);
    
    // Download media from WhatsApp
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
      },
      timeout: 60000, // 60 seconds
      maxContentLength: 100 * 1024 * 1024, // 100MB max
    });
    
    console.log(`✅ Downloaded ${response.data.length} bytes from WhatsApp`);
    
    // Convert to base64 for Cloudinary
    const base64Data = Buffer.from(response.data).toString('base64');
    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    
    // Upload options
    const uploadOptions: any = {
      folder: `whatsapp_media/user_${userId}`,
      public_id: `whatsapp_${whatsappMediaId}_${Date.now()}`,
      tags: ['whatsapp', `user_${userId}`],
      context: {
        whatsapp_media_id: whatsappMediaId,
        caption: mediaInfo.caption || '',
        user_id: userId,
        message_id: messageId || '',
      },
      resource_type: this.getResourceTypeFromMimeType(mimeType),
      overwrite: false,
    };
    
    console.log(`☁️ Uploading ${response.data.length} bytes to Cloudinary...`);
    
    // Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(dataUri, uploadOptions);
    
    console.log(`✅ Cloudinary upload successful. Public ID: ${cloudinaryResult.public_id}`);
    
    // 5. Save to media attachments table
    const mediaAttachmentData: any = {
      messageId: messageId || null, // Link to message if provided
      uploadedByUserId: userId,
      publicId: cloudinaryResult.public_id,
      resourceType: cloudinaryResult.resource_type,
      format: cloudinaryResult.format,
      version: cloudinaryResult.version,
      secureUrl: cloudinaryResult.secure_url,
      originalFilename: mediaInfo.filename || `${whatsappMediaId}.${cloudinaryResult.format}`,
      mimeType: mimeType,
      fileSize: cloudinaryResult.bytes,
      width: cloudinaryResult.width || null,
      height: cloudinaryResult.height || null,
      duration: cloudinaryResult.duration || null,
      caption: mediaInfo.caption,
      tags: ['whatsapp', 'incoming'],
      status: 'active',
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Generate thumbnail URL for images/videos
    if (cloudinaryResult.resource_type === 'image' || cloudinaryResult.resource_type === 'video') {
      const thumbnailUrl = cloudinary.url(cloudinaryResult.public_id, {
        transformation: [
          { width: 300, height: 300, crop: 'fill' },
          { quality: 'auto:good' },
        ],
      });
      mediaAttachmentData.thumbnailUrl = thumbnailUrl;
    }
    
    const [mediaAttachment] = await db.insert(mediaAttachments)
      .values(mediaAttachmentData)
      .returning();
    
    console.log(`✅ Media attachment saved: ${mediaAttachment?.id}`);
    
    // 6. Return success result
    return {
      success: true,
      mediaAttachment,
    };
    
  } catch (error: any) {
    console.error('❌ WhatsApp media processing error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process media',
    };
  }
}

  /**
   * Handle incoming WhatsApp media message
   */
  static async handleIncomingMediaMessage(
    message: any,
    contactId: string,
    conversationId: string,
    userId: string
  ) {
    try {
      const db = getDb();
      
      const messageType = message.type;
      const mediaData = message[messageType];
      
      if (!mediaData?.id) {
        throw new Error('No media ID in message');
      }

      // 1. Save message first (will update with media ID later)
const [savedMessage] = await db.insert(messages).values({
  conversationId,
  contactId,
  whatsappMessageId: message.id,
  direction: 'incoming',
  messageType,
  body: mediaData.caption || mediaData.filename || `${messageType} message`,
  status: 'received',
  timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(), // Convert to ISO string
  metadata: {
    type: messageType,
    [messageType]: mediaData,
    processing: true, // Mark as processing
  },
  
}).returning();



      // 2. Process media in background (don't wait)
      this.processMediaInBackground(mediaData, messageType, userId, savedMessage?.id||'');

      return savedMessage;
    } catch (error: any) {
      console.error('❌ Handle incoming media message error:', error);
      throw error;
    }
  }

  /**
   * Process media in background (non-blocking)
   */
  private static async processMediaInBackground(
    mediaData: any,
    messageType: string,
    userId: string,
    messageId: string
  ) {
    try {
      const db = getDb();
      
      const mediaInfo: WhatsAppMediaInfo = {
        id: mediaData.id,
        mime_type: mediaData.mime_type || this.getMimeTypeFromMessageType(messageType),
        sha256: mediaData.sha256,
        caption: mediaData.caption,
        filename: mediaData.filename,
      };

      console.log(`🔄 Starting background processing for message ${messageId}`);
      
      // Process the media
      const result = await this.processWhatsAppMedia(
        mediaInfo.id,
        mediaInfo,
        userId,
        messageId
      );

      // Update message with result
      await db.update(messages)
        .set({
          metadata: {
            processing: false,
            processed: result.success,
            error: result.error,
            mediaAttachmentId: result.mediaAttachment?.id,
          },
          mediaAttachmentId: result.mediaAttachment?.id,
          status: result.success ? 'delivered' : 'failed',
        })
        .where(eq(messages.id, messageId));

      if (result.success) {
        console.log(`✅ Background processing completed for message ${messageId}`);
      } else {
        console.error(`❌ Background processing failed for message ${messageId}:`, result.error);
      }

    } catch (error: any) {
      console.error('❌ Background media processing error:', error);
      
      // Update message with error
      const db = getDb();
      await db.update(messages)
        .set({
          metadata: {
            processing: false,
            processed: false,
            error: error.message,
          },
          status: 'failed',
        })
        .where(eq(messages.id, messageId));
    }
  }

  /**
   * Send media message via WhatsApp
   */
  static async sendMediaMessage(
    phoneNumberId: string,
    to: string,
    cloudinaryUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    accessToken: string,
    caption?: string,
    filename?: string
  ) {
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
              caption: caption?.substring(0, 3000), // WhatsApp caption limit
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
              filename: filename || caption?.substring(0, 240) || 'document',
            },
          };
          break;

        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      console.log(`📤 Sending ${mediaType} message via WhatsApp`);
      return await WhatsAppService.sendMessage(phoneNumberId, payload, accessToken);
    } catch (error: any) {
      console.error('❌ Send media message error:', error);
      throw error;
    }
  }

  /**
   * Get mime type from WhatsApp message type
   */
  private static getMimeTypeFromMessageType(messageType: string): string {
    const mimeTypes: Record<string, string> = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'audio': 'audio/mpeg',
      'document': 'application/pdf',
      'sticker': 'image/webp',
    };
    
    return mimeTypes[messageType] || 'application/octet-stream';
  }

  /**
   * Get Cloudinary URL with optimizations for WhatsApp
   */
  static getOptimizedUrlForWhatsApp(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): string {
    const transformation = [];
    
    if (resourceType === 'image') {
      // Optimize images for WhatsApp
      transformation.push(
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
        { width: 1600, crop: 'limit' } // WhatsApp max width
      );
    } else if (resourceType === 'video') {
      // Optimize videos for WhatsApp
      transformation.push(
        { quality: 'auto:good' },
        { fetch_format: 'mp4' },
        { duration: 60, crop: 'limit' } // WhatsApp max duration
      );
    }
    
    return this.generateUrl(publicId, {
      resourceType,
      transformation,
    });
  }

  /**
   * Upload from URL to Cloudinary
   */
 private static async uploadFromUrl(
  url: string,
  options: CloudinaryUploadOptions = {},
  accessToken: string // ADD THIS PARAMETER
): Promise<any> {
  try {
    console.log(`📥 Downloading media from WhatsApp with authentication...`);
    
    // 1. Download media from WhatsApp first (with auth)
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 60000, // 60 seconds
      maxContentLength: 100 * 1024 * 1024, // 100MB max
    });
    
    console.log(`✅ Downloaded ${response.data.length} bytes from WhatsApp`);
    
    // 2. Configure Cloudinary
    this.configureCloudinary();
    
    // 3. Convert buffer to base64 for Cloudinary upload
    const base64Data = Buffer.from(response.data).toString('base64');
    const dataUri = `data:${this.getMimeTypeFromBuffer(response.data)};base64,${base64Data}`;
    
    // 4. Prepare upload options
    const uploadOptions: any = {
      folder: options.folder || 'whatsapp_media',
      tags: options.tags || ['whatsapp'],
      context: options.context,
      resource_type: options.resource_type || 'auto',
      overwrite: options.overwrite || false,
    };
    
    if (options.public_id) {
      uploadOptions.public_id = options.public_id;
    }
    
    console.log(`☁️ Uploading ${response.data.length} bytes to Cloudinary...`);
    
    // 5. Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
    
    console.log(`✅ Cloudinary upload successful. Public ID: ${result.public_id}`);
    
    return {
      success: true,
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      duration: result.duration,
      resource_type: result.resource_type,
    };
  } catch (error: any) {
    console.error('❌ Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Guess mime type from buffer
 */
private static getMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  // Simple detection - you can improve this
  const uint8 = new Uint8Array(buffer);
  if (uint8.length < 4) return 'application/octet-stream';
  
  // Check for common file signatures
  const hex = Array.from(uint8.slice(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  
  // JPEG
  if (hex.startsWith('FFD8')) return 'image/jpeg';
  // PNG
  if (hex === '89504E47') return 'image/png';
  // GIF
  if (hex.startsWith('474946')) return 'image/gif';
  // PDF
  if (hex.startsWith('25504446')) return 'application/pdf';
  // MP4
  if (hex.startsWith('000000') && hex.endsWith('6674')) return 'video/mp4';
  
  return 'application/octet-stream';
}
  /**
   * Get resource type from mime type
   */
  private static getResourceTypeFromMimeType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'video'; // Cloudinary treats audio as video
    } else {
      return 'raw'; // For documents
    }
  }

  /**
   * Generate thumbnail URL
   */
  private static generateThumbnailUrl(publicId: string): string {
    return this.generateUrl(publicId, {
      transformation: [
        { width: 300, height: 300, crop: 'fill' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });
  }

  /**
   * Generate responsive thumbnails
   */
  private static generateResponsiveThumbnails(publicId: string): {
    small: string;
    medium: string;
    large: string;
  } {
    return {
      small: this.generateUrl(publicId, {
        transformation: [
          { width: 150, height: 150, crop: 'fill' },
          { quality: 'auto:good' },
        ],
      }),
      medium: this.generateUrl(publicId, {
        transformation: [
          { width: 300, height: 300, crop: 'fill' },
          { quality: 'auto:good' },
        ],
      }),
      large: this.generateUrl(publicId, {
        transformation: [
          { width: 600, height: 600, crop: 'fill' },
          { quality: 'auto:good' },
        ],
      }),
    };
  }

  /**
   * Generate Cloudinary URL
   */
  private static generateUrl(
    publicId: string,
    options: {
      resourceType?: 'image' | 'video' | 'raw';
      transformation?: any[];
      secure?: boolean;
    } = {}
  ): string {
    const config = {
      resource_type: options.resourceType || 'image',
      secure: options.secure !== false, // Default to secure
    };

    if (options.transformation) {
      return cloudinary.url(publicId, {
        ...config,
        transformation: options.transformation,
      });
    }

    return cloudinary.url(publicId, config);
  }

  /**
   * Configure Cloudinary
   */
private static configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
  }
  
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

  /**
   * Download WhatsApp media to buffer
   */
  private static async downloadMediaToBuffer(
    url: string,
    accessToken: string
  ): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('❌ Error downloading media:', error);
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }

  /**
   * Delete media from Cloudinary
   */
  static async deleteFromCloudinary(publicId: string, resourceType: string = 'image'): Promise<boolean> {
    try {
      this.configureCloudinary();
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType as any,
      });
      console.log(`✅ Deleted from Cloudinary: ${publicId}`);
      return true;
    } catch (error: any) {
      console.error('❌ Error deleting from Cloudinary:', error);
      return false;
    }
  }

  /**
   * Get media info from Cloudinary
   */
  static async getCloudinaryInfo(publicId: string): Promise<any> {
    try {
      this.configureCloudinary();
      return await cloudinary.api.resource(publicId);
    } catch (error: any) {
      console.error('❌ Error getting Cloudinary info:', error);
      return null;
    }
  }

  /**
   * List user's WhatsApp media
   */
static async listUserMedia(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<any[]> {
  try {
    const db = getDb();
    const offset = (page - 1) * limit;

    const media = await db.select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.uploadedByUserId, userId))
      .orderBy(mediaAttachments.createdAt)
      .limit(limit)
      .offset(offset);

    return media;
  } catch (error: any) {
    console.error('❌ Error listing user media:', error);
    return [];
  }
}
}