// backend/src/services/quick-reply-media.service.ts
import { getDb } from '../db/client';
import { mediaAttachments } from '../db/schema';
import { CloudinaryService } from './cloudinary.service';
import { eq, and, inArray } from 'drizzle-orm';

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
      secureUrl: cloudinaryResult?.secureUrl || mediaData.secureUrl || mediaData.url,
      thumbnailUrl: cloudinaryResult?.secureUrl || mediaData.secureUrl || mediaData.url,
      originalFilename: mediaData.originalname,
      mimeType: mediaData.mimetype,
      fileSize: mediaData.size,
      width: cloudinaryResult?.width || undefined,
      height: cloudinaryResult?.height || undefined,
      duration: cloudinaryResult?.duration || undefined,
      format: cloudinaryResult?.format || mediaData.originalname.split('.').pop(),
      resourceType: CloudinaryService.getResourceTypeFromMimeType(mediaData.mimetype),
      tags: ['quick_reply', 'media'],
      caption: mediaData.originalname,
      status: 'active',
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
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
          eq(mediaAttachments.messageId, null) // Quick reply media have null messageId
        )
      )
      .orderBy(mediaAttachments.createdAt);

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
        updatedAt: new Date(),
      })
      .where(eq(mediaAttachments.id, attachmentId));

    return { success: true };
  }
}