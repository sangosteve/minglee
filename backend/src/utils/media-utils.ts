// backend/src/utils/media-utils.ts

import { getDb } from '../db/client';
import { mediaAttachments } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { WhatsAppTemplateError } from '../services/whatsapp-template.service';

/**
 * Get the correct media format for WhatsApp templates
 */
export function getWhatsAppMediaFormat(
  mediaType: string,
  cloudinaryUrl: string,
  options?: {
    caption?: string;
    filename?: string;
  }
): any {
  const type = mediaType.toLowerCase();
  const validTypes = ['image', 'video', 'document'];

  if (!validTypes.includes(type)) {
    throw new WhatsAppTemplateError(`Invalid media type for WhatsApp: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }

  if (!cloudinaryUrl || !cloudinaryUrl.startsWith('http')) {
    throw new WhatsAppTemplateError(`Invalid Cloudinary URL: ${cloudinaryUrl}`);
  }

  // WhatsApp expects specific structure for media parameters
  const mediaParameter: any = {
    link: cloudinaryUrl,
    ...(options?.caption ? { caption: options.caption.substring(0, 3000) } : {}),
    ...(options?.filename ? { filename: options.filename.substring(0, 240) } : {}),
  };

  // Return the correct parameter structure based on type
  return {
    type: type as 'image' | 'video' | 'document',
    [type]: mediaParameter,
  };
}

/**
 * Validate media for WhatsApp template headers
 */
export function validateTemplateMedia(
  templateComponents: any[],
  mediaData: any
): string[] {
  const errors: string[] = [];

  // Find header component
  const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
  
  if (!headerComponent) {
    return errors; // No header, no media validation needed
  }

  const headerFormat = headerComponent.format;
  const hasMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat || '');

  if (!hasMediaHeader) {
    return errors; // Not a media header
  }

  // If it's a media header, media is required
  if (!mediaData?.url) {
    errors.push(`${headerFormat} header requires media file`);
    return errors;
  }

  // Validate URL
  try {
    const url = new URL(mediaData.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push('Media URL must use http or https protocol');
    }
  } catch {
    errors.push('Media URL is not valid');
  }

  // Validate media type matches header format
  const mediaType = mediaData.type?.toLowerCase();
  const expectedType = headerFormat?.toLowerCase();

  if (mediaType && expectedType && mediaType !== expectedType) {
    errors.push(`Media type mismatch. Expected: ${expectedType}, Got: ${mediaType}`);
  }

  // Validate caption length if provided
  if (mediaData.caption && mediaData.caption.length > 3000) {
    errors.push('Media caption exceeds maximum length of 3000 characters');
  }

  // Validate filename length if provided
  if (mediaData.filename && mediaData.filename.length > 240) {
    errors.push('Media filename exceeds maximum length of 240 characters');
  }

  // Check file size limits (WhatsApp limits)
  const maxSizes: Record<string, number> = {
    image: 5 * 1024 * 1024, // 5MB
    video: 16 * 1024 * 1024, // 16MB
    document: 100 * 1024 * 1024 // 100MB
  };

  if (mediaData.fileSize && expectedType && maxSizes[expectedType]) {
    if (mediaData.fileSize > maxSizes[expectedType]) {
      const maxMB = maxSizes[expectedType] / (1024 * 1024);
      errors.push(`${headerFormat} exceeds size limit (${maxMB}MB)`);
    }
  }

  return errors;
}

/**
 * Get recently uploaded media for user
 */
export async function getRecentUserMedia(
  userId: string,
  limit: number = 5
): Promise<any[]> {
  const db = getDb();
  
  try {
    const recentMedia = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          eq(mediaAttachments.uploadedByUserId, userId),
          sql`${mediaAttachments.tags} && array['quick_reply']::text[]`
        )
      )
      .orderBy(desc(mediaAttachments.uploadedAt))
      .limit(limit);
    
    return recentMedia.map(media => ({
      id: media.id,
      publicId: media.publicId,
      secureUrl: media.secureUrl,
      thumbnailUrl: media.thumbnailUrl,
      resourceType: media.resourceType,
      format: media.format,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      duration: media.duration,
      caption: media.caption,
      originalFilename: media.originalFilename,
      uploadedAt: media.uploadedAt,
    }));
  } catch (error) {
    console.error('Error getting recent media:', error);
    return [];
  }
}

/**
 * Get Cloudinary URL for template media
 */
export function getCloudinaryUrlForTemplate(
  publicId: string,
  resourceType: 'image' | 'video' | 'document' = 'image',
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  }
): string {
  // Base Cloudinary URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  
  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME is not configured');
  }

  // Default transformations for WhatsApp optimization
  const defaultTransformations: Record<string, any> = {
    image: {
      width: 1600,
      crop: 'limit',
      quality: 'auto:good',
      format: 'jpg'
    },
    video: {
      width: 1280,
      crop: 'limit',
      quality: 'auto:good',
      format: 'mp4'
    },
    document: {
      // No transformations for documents
    }
  };

  const transform = options || defaultTransformations[resourceType] || {};
  
  // Build transformation string
  const transformations: string[] = [];
  
  if (transform.width && transform.height) {
    transformations.push(`c_${transform.crop || 'fill'},w_${transform.width},h_${transform.height}`);
  } else if (transform.width) {
    transformations.push(`w_${transform.width}`);
  } else if (transform.height) {
    transformations.push(`h_${transform.height}`);
  }
  
  if (transform.quality) {
    transformations.push(`q_${transform.quality}`);
  }
  
  const transformationStr = transformations.length > 0 ? transformations.join(',') + '/' : '';
  
  // Construct URL
  const format = transform.format || 'auto';
  const version = Date.now(); // Use timestamp for cache busting
  
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${transformationStr}v${version}/${publicId}.${format}`;
}

/**
 * Extract media info from template
 */
export function getTemplateMediaRequirements(templateComponents: any[]): {
  hasMediaHeader: boolean;
  mediaType?: string;
  format?: string;
  requiresMedia: boolean;
} {
  const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
  
  if (!headerComponent) {
    return {
      hasMediaHeader: false,
      requiresMedia: false,
    };
  }

  const format = headerComponent.format;
  const hasMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format || '');
  
  return {
    hasMediaHeader,
    mediaType: hasMediaHeader ? format?.toLowerCase() : undefined,
    format: format,
    requiresMedia: hasMediaHeader,
  };
}

/**
 * Prepare media parameters for WhatsApp API
 */
export function prepareMediaParametersForWhatsApp(
  mediaData: any,
  templateComponents: any[]
): any[] | null {
  const { hasMediaHeader, mediaType } = getTemplateMediaRequirements(templateComponents);
  
  if (!hasMediaHeader || !mediaData?.url) {
    return null;
  }

  if (!mediaType) {
    throw new Error('Media type is required for media header');
  }

  // Create the media parameter for WhatsApp
  const parameter = {
    type: mediaType as 'image' | 'video' | 'document',
    [mediaType]: {
      link: mediaData.url,
      ...(mediaData.caption ? { caption: mediaData.caption.substring(0, 3000) } : {}),
      ...(mediaData.filename ? { filename: mediaData.filename.substring(0, 240) } : {}),
    }
  };

  return [parameter];
}