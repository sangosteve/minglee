// backend/src/services/quick-reply-media.service.ts
import { getDb } from '../db/client';
import { mediaAttachments } from '../db/schema';
import { CloudinaryService } from './cloudinary.service';
import { eq, and, inArray, isNull,desc } from 'drizzle-orm';

export interface MediaUploadData {
  buffer?: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  url?: string;
  secureUrl?: string;
  publicId?: string;
}

export class QuickReplyMediaService {
  /**
   * Create media attachment for quick reply
   */
  static async createMediaAttachment(
    userId: string,
    mediaData: MediaUploadData,
    quickReplyId?: string
  ) {
    const db = getDb();

    let cloudinaryResult;
    
    // If we have a buffer, upload to Cloudinary
    if (mediaData.buffer) {
      cloudinaryResult = await CloudinaryService.uploadFile(
        {
          buffer: mediaData.buffer,
          originalname: mediaData.originalname,
          mimetype: mediaData.mimetype,
          size: mediaData.size,
        },
        {
          folder: `quick_replies/user_${userId}`,
          tags: ['quick_reply', `user_${userId}`, quickReplyId ? `quick_reply_${quickReplyId}` : ''],
          context: {
            quick_reply_id: quickReplyId || 'unknown',
            original_filename: mediaData.originalname,
            uploaded_by_user: userId,
          },
        }
      );

      if (!cloudinaryResult.success) {
        throw new Error(`Cloudinary upload failed: ${cloudinaryResult.error}`);
      }
    }

    // Create media attachment record
const [mediaAttachment] = await db.insert(mediaAttachments).values({
  // messageId can be null for quick replies
  messageId: null,
  uploadedByUserId: userId,
  publicId: cloudinaryResult?.publicId || mediaData.publicId || `qr_${Date.now()}`,
  // secureUrl is REQUIRED - ensure it's never undefined
  secureUrl: cloudinaryResult?.secureUrl || mediaData.secureUrl || mediaData.url || '',
  // thumbnailUrl is optional
  thumbnailUrl: cloudinaryResult?.secureUrl || mediaData.secureUrl || mediaData.url || null,
  originalFilename: mediaData.originalname,
  mimeType: mediaData.mimetype,
  fileSize: mediaData.size,
  // Use null instead of undefined for optional number fields
  width: cloudinaryResult?.width || null,
  height: cloudinaryResult?.height || null,
  duration: cloudinaryResult?.duration || null,
  format: cloudinaryResult?.format || mediaData.originalname.split('.').pop() || null,
  resourceType: CloudinaryService.getResourceTypeFromMimeType(mediaData.mimetype),
  tags: ['quick_reply', 'media'],
  caption: mediaData.originalname,
  status: 'active',
  // Don't include createdAt/updatedAt if they have defaults
}).returning();

    return mediaAttachment;
  }

  /**
   * Get media attachments by IDs
   */
  static async getMediaAttachmentsByIds(attachmentIds: string[], userId: string) {
    const db = getDb();

    if (!attachmentIds || attachmentIds.length === 0) {
      return [];
    }

    const attachments = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          inArray(mediaAttachments.id, attachmentIds),
          eq(mediaAttachments.uploadedByUserId, userId)
        )
      );

    return attachments;
  }

  /**
   * Get all quick reply media for a user
   */
static async getUserQuickReplyMedia(userId: string) {
  const db = getDb();

  const attachments = await db.select()
    .from(mediaAttachments)
    .where(
      and(
        eq(mediaAttachments.uploadedByUserId, userId),
        isNull(mediaAttachments.messageId),
        // Optionally check for quick_reply tag if you're using tags
        // arrayContains(mediaAttachments.tags, ['quick_reply'])
      )
    )
    .orderBy(desc(mediaAttachments.createdAt));

  return attachments;
}

  /**
   * Delete media attachment
   */
  static async deleteMediaAttachment(attachmentId: string, userId: string) {
    const db = getDb();

    // Check ownership
    const [attachment] = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          eq(mediaAttachments.id, attachmentId),
          eq(mediaAttachments.uploadedByUserId, userId)
        )
      )
      .limit(1);

    if (!attachment) {
      throw new Error('Media attachment not found or access denied');
    }

    // Delete from Cloudinary if we have a publicId
    if (attachment.publicId && !attachment.publicId.startsWith('qr_')) {
      await CloudinaryService.deleteFile(
        attachment.publicId,
        attachment.resourceType as any
      );
    }

    // Delete from database
    await db.delete(mediaAttachments)
      .where(eq(mediaAttachments.id, attachmentId));

    return { success: true };
  }

  /**
   * Update media attachment with quick reply ID reference
   */
  static async linkMediaToQuickReply(attachmentId: string, quickReplyId: string, userId: string) {
    const db = getDb();

    // Verify ownership
    const [attachment] = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          eq(mediaAttachments.id, attachmentId),
          eq(mediaAttachments.uploadedByUserId, userId)
        )
      )
      .limit(1);

    if (!attachment) {
      throw new Error('Media attachment not found or access denied');
    }

    // Update tags to include quick reply ID
    const updatedTags = [...(attachment.tags || []), `quick_reply_${quickReplyId}`];
    
   await db.update(mediaAttachments)
  .set({
    tags: updatedTags,
    updatedAt: new Date().toISOString(), // Convert Date to ISO string
  })
  .where(eq(mediaAttachments.id, attachmentId));

return { success: true };
  }
}