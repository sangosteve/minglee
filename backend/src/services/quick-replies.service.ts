//backend/src/services/quick-replies.service.ts
import { getDb } from '../db/client';
import { quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, inArray } from 'drizzle-orm';

export class QuickRepliesService {
  static async getQuickReplies(userId: string, filters?: {
    page?: number;
    limit?: number;
    search?: string;
    topics?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, search, topics, isActive } = filters || {};
    const offset = (page - 1) * limit;
    const db = getDb();

    const whereConditions: any[] = [eq(quickReplies.userId, userId)];

    if (isActive !== undefined) {
      whereConditions.push(eq(quickReplies.isActive, isActive));
    }

    if (search) {
      whereConditions.push(or(
        like(quickReplies.name, `%${search}%`),
        like(quickReplies.message, `%${search}%`),
        like(quickReplies.topics, `%${search}%`)
      ));
    }

    if (topics) {
      whereConditions.push(like(quickReplies.topics, `%${topics}%`));
    }

    // Get quick replies
    const quickRepliesList = await db.select()
      .from(quickReplies)
      .where(and(...whereConditions))
      .orderBy(desc(quickReplies.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get all media attachment IDs from all quick replies
    const allMediaAttachmentIds = quickRepliesList
      .flatMap(qr => qr.mediaAttachmentIds || [])
      .filter(Boolean);

    let mediaAttachmentsMap: Record<string, any> = {};

    if (allMediaAttachmentIds.length > 0) {
      // Get all media attachments in one query
      const mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, allMediaAttachmentIds));

      // Create a map for easy lookup
      mediaAttachmentsMap = mediaAttachmentsList.reduce((acc, media) => {
        acc[media.id] = media;
        return acc;
      }, {} as Record<string, any>);
    }

    // Enrich quick replies with media attachments
    const enrichedQuickReplies = quickRepliesList.map(qr => ({
      ...qr,
      mediaAttachments: (qr.mediaAttachmentIds || [])
        .map(id => mediaAttachmentsMap[id])
        .filter(Boolean)
    }));

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(quickReplies)
      .where(and(...whereConditions));

    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    return {
      quickReplies: enrichedQuickReplies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getQuickReplyById(userId: string, quickReplyId: string) {
    const db = getDb();

    const quickReplyResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!quickReplyResult.length) return null;

    const quickReply = quickReplyResult[0];

    // Get media attachments if any
    let mediaAttachmentsList: any[] = [];
    if (quickReply.mediaAttachmentIds && quickReply.mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, quickReply.mediaAttachmentIds));
    }

    return {
      ...quickReply,
      mediaAttachments: mediaAttachmentsList
    };
  }

  static async createQuickReply(userId: string, data: {
    name: string;
    message: string;
    topics?: string;
    mediaAttachmentIds?: string[];
    isActive?: boolean;
  }) {
    const db = getDb();

    const [quickReply] = await db.insert(quickReplies).values({
      userId,
      name: data.name,
      message: data.message,
      topics: data.topics || 'General',
      mediaAttachmentIds: data.mediaAttachmentIds || [],
      isActive: data.isActive !== undefined ? data.isActive : true,
    }).returning();

    return quickReply;
  }

  static async updateQuickReply(userId: string, quickReplyId: string, data: {
    name?: string;
    message?: string;
    topics?: string;
    mediaAttachmentIds?: string[];
    isActive?: boolean;
  }) {
    const db = getDb();

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.topics !== undefined) updateData.topics = data.topics;
    if (data.mediaAttachmentIds !== undefined) updateData.mediaAttachmentIds = data.mediaAttachmentIds;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedAt = new Date();

    const [updatedQuickReply] = await db.update(quickReplies)
      .set(updateData)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, userId)
      ))
      .returning();

    return updatedQuickReply;
  }

  static async deleteQuickReply(userId: string, quickReplyId: string) {
    const db = getDb();

    const [deletedQuickReply] = await db.delete(quickReplies)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, userId)
      ))
      .returning();

    return deletedQuickReply;
  }
}