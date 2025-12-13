import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import path from 'path';
import stream from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: any[];
  tags?: string[];
  context?: Record<string, string>;
  eager?: any[];
  overwrite?: boolean;
  invalidate?: boolean;
}

export interface MediaFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface CloudinaryUploadResult {
  success: boolean;
  data?: UploadApiResponse;
  error?: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize: number;
  resourceType: string;
}

export class CloudinaryService {
  
  /**
   * Upload a file to Cloudinary from buffer (using base64)
   */
  static async uploadFile(
    file: MediaFile,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const { buffer, originalname, mimetype } = file;

      // Convert buffer to base64 data URI
      const base64Data = buffer.toString('base64');
      const dataUri = `data:${mimetype};base64,${base64Data}`;

      // Determine resource type
      const resourceType = options.resource_type || this.getResourceTypeFromMimeType(mimetype);

      // Prepare upload options
      const uploadOptions: any = {
        resource_type: resourceType,
        folder: options.folder || 'whatsapp_media',
        public_id: options.public_id || this.generatePublicId(originalname),
        tags: options.tags || [],
        context: options.context || {},
        overwrite: options.overwrite || false,
        invalidate: options.invalidate || true,
      };

      // Add format-specific optimizations
      if (resourceType === 'image') {
        uploadOptions.quality = 'auto:good';
        uploadOptions.fetch_format = 'auto';
      }

      // Add eager transformations if provided
      if (options.eager) {
        uploadOptions.eager = options.eager;
      }

      // Upload using Cloudinary's built-in upload method
      const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

      return {
        success: true,
        data: result,
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
        fileSize: result.bytes,
        resourceType: result.resource_type,
      };
    } catch (error: any) {
      console.error('❌ Cloudinary upload error:', error);
      return {
        success: false,
        error: error.message,
        publicId: '',
        url: '',
        secureUrl: '',
        format: '',
        fileSize: 0,
        resourceType: '',
      };
    }
  }

  /**
   * Stream upload for large files
   */
  static async streamUpload(
    fileStream: NodeJS.ReadableStream,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const cloudinaryStream = cloudinary.uploader.upload_stream(
        {
          resource_type: options.resource_type || 'auto',
          folder: options.folder || 'whatsapp_media',
          public_id: options.public_id || `stream_${Date.now()}`,
          tags: options.tags || [],
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary stream upload error:', error);
            resolve({
              success: false,
              error: error.message,
              publicId: '',
              url: '',
              secureUrl: '',
              format: '',
              fileSize: 0,
              resourceType: '',
            });
          } else if (result) {
            resolve({
              success: true,
              data: result,
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              format: result.format,
              width: result.width,
              height: result.height,
              duration: result.duration,
              fileSize: result.bytes,
              resourceType: result.resource_type,
            });
          }
        }
      );

      fileStream.pipe(cloudinaryStream);
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  static async deleteFile(
    publicId: string, 
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      
      return {
        success: result.result === 'ok',
        result: result.result,
      };
    } catch (error: any) {
      console.error('❌ Cloudinary delete error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate a Cloudinary URL with transformations
   */
  static generateUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: number | string;
      format?: string;
      resourceType?: 'image' | 'video' | 'raw';
      transformation?: any[];
    } = {}
  ): string {
    const transformation = options.transformation || [];

    // Add size transformations if specified
    if (options.width || options.height) {
      transformation.push({
        width: options.width,
        height: options.height,
        crop: options.crop || 'fill',
      });
    }

    // Add quality optimization
    if (options.quality) {
      transformation.push({ quality: options.quality });
    }

    // Add format conversion
    if (options.format) {
      transformation.push({ fetch_format: options.format });
    }

    return cloudinary.url(publicId, {
      resource_type: options.resourceType || 'image',
      secure: true,
      transformation,
    });
  }

  /**
   * Generate a thumbnail URL
   */
  static generateThumbnailUrl(
    publicId: string, 
    width: number = 300, 
    height: number = 300
  ): string {
    return this.generateUrl(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto:good',
      format: 'webp',
    });
  }

  /**
   * Generate multiple thumbnail sizes (for responsive images)
   */
  static generateResponsiveThumbnails(
    publicId: string,
    sizes: { width: number; height: number }[] = [
      { width: 100, height: 100 },
      { width: 300, height: 300 },
      { width: 600, height: 600 },
    ]
  ): Array<{ width: number; height: number; url: string }> {
    return sizes.map(size => ({
      width: size.width,
      height: size.height,
      url: this.generateThumbnailUrl(publicId, size.width, size.height),
    }));
  }

  /**
   * Get resource type from mimetype
   */
  static getResourceTypeFromMimeType(mimetype: string): 'image' | 'video' | 'raw' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'video'; // Cloudinary treats audio as video
    return 'raw';
  }

  /**
   * Generate a unique public ID from filename
   */
  static generatePublicId(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const nameWithoutExt = path.parse(filename).name;
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    return `${sanitizedName}_${timestamp}_${random}`.toLowerCase();
  }

  /**
   * Get file information from Cloudinary
   */
  static async getFileInfo(
    publicId: string, 
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('❌ Cloudinary get file info error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a folder in Cloudinary
   */
  static async createFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await cloudinary.api.create_folder(folderPath);
      return { success: true };
    } catch (error: any) {
      if (error.error?.message?.includes('already exists')) {
        return { success: true };
      }
      console.error('❌ Cloudinary create folder error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for files in Cloudinary
   */
  static async searchFiles(
    expression: string,
    options: {
      max_results?: number;
      next_cursor?: string;
      sort_by?: { [key: string]: string };
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data = await cloudinary.search
        .expression(expression)
        .max_results(options.max_results || 10)
        .next_cursor(options.next_cursor)
        .sort_by('created_at', 'desc')
        .execute();
      
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('❌ Cloudinary search error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate upload signature for direct frontend uploads
   */
  static generateUploadSignature(params: any): string {
    return cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
  }
}