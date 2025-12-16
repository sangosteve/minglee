import { getDb } from '../db/client';
import { quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, like, desc, asc, or, inArray,sql } from 'drizzle-orm';
import type { QuickReply } from '../types/quick-reply';

export interface CreateQuickReplyData {
  name: string;
  message: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface UpdateQuickReplyData {
  name?: string;
  message?: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface QuickReplyFilters {
  page?: number;
  limit?: number;
  search?: string;
  topics?: string[];
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class QuickRepliesService {
  // Create a new quick reply
  static async createQuickReply(userId: string, data: CreateQuickReplyData) {
    const db = getDb();
    
    const [quickReply] = await db.insert(quickReplies).values({
      userId,
      name: data.name,
      message: data.message,
      topics: data.topics || 'General',
      mediaAttachmentIds: data.mediaAttachmentIds || [],
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return quickReply;
  }

  // Get quick reply by ID
  static async getQuickReplyById(userId: string, id: string) {
    const db = getDb();
    
    const [reply] = await db.select()
      .from(quickReplies)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      )
      .limit(1);
    
    if (!reply) {
      return null;
    }
    
    // Fetch media attachments if any
    let mediaAttachmentsList = [];
    if (reply.mediaAttachmentIds && reply.mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, reply.mediaAttachmentIds));
    }
    
    return {
      ...reply,
      mediaAttachments: mediaAttachmentsList,
    };
  }

  // Get all quick replies for user
  static async getQuickReplies(userId: string, filters: QuickReplyFilters = {}) {
    const db = getDb();
    const {
      page = 1,
      limit = 20,
      search,
      topics,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;
    
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const conditions = [eq(quickReplies.userId, userId)];
    
    if (search) {
      conditions.push(
        or(
          like(quickReplies.name, `%${search}%`),
          like(quickReplies.message, `%${search}%`),
          like(quickReplies.topics, `%${search}%`)
        )
      );
    }
    
    if (topics && topics.length > 0) {
      const topicConditions = topics.map(topic => 
        like(quickReplies.topics, `%${topic}%`)
      );
      conditions.push(or(...topicConditions));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(quickReplies.isActive, isActive));
    }
    
    // Build query
    let query = db.select()
      .from(quickReplies)
      .where(and(...conditions));
    
    // Apply sorting
    const sortField = {
      'name': quickReplies.name,
      'topics': quickReplies.topics,
      'createdAt': quickReplies.createdAt,
      'updatedAt': quickReplies.updatedAt,
    }[sortBy] || quickReplies.createdAt;
    
    const sortedQuery = query.orderBy(
      sortOrder === 'desc' ? desc(sortField) : asc(sortField)
    );
    
    // Get paginated results
    const replies = await sortedQuery
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(quickReplies)
      .where(and(...conditions));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;
    
    return {
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Update quick reply
  static async updateQuickReply(
    userId: string,
    id: string,
    data: UpdateQuickReplyData
  ) {
    const db = getDb();
    
    // Check if quick reply exists and belongs to user
    const [existingReply] = await db.select()
      .from(quickReplies)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      )
      .limit(1);
    
    if (!existingReply) {
      return null;
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Only update fields that are provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.topics !== undefined) updateData.topics = data.topics;
    if (data.mediaAttachmentIds !== undefined) {
      updateData.mediaAttachmentIds = data.mediaAttachmentIds;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const [updatedReply] = await db.update(quickReplies)
      .set(updateData)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      )
      .returning();
    
    return updatedReply;
  }

  // Delete quick reply
  static async deleteQuickReply(userId: string, id: string) {
    const db = getDb();
    
    // Check if quick reply exists and belongs to user
    const [existingReply] = await db.select()
      .from(quickReplies)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      )
      .limit(1);
    
    if (!existingReply) {
      return false;
    }
    
    await db.delete(quickReplies)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      );
    
    return true;
  }

  // Get topics for quick replies
  static async getTopics(userId: string) {
    const db = getDb();
    
    const result = await db.execute(sql`
      SELECT DISTINCT unnest(string_to_array(topics, ',')) as topic
      FROM quick_replies
      WHERE "userId" = ${userId}
      AND is_active = true
      ORDER BY topic
    `);
    
    const topics = Array.isArray(result.rows) 
      ? result.rows.map((row: any) => row.topic?.trim()).filter(Boolean)
      : [];
    
    return [...new Set(topics)]; // Remove duplicates
  }

  // Duplicate quick reply
  static async duplicateQuickReply(userId: string, id: string) {
    const db = getDb();
    
    const [existingReply] = await db.select()
      .from(quickReplies)
      .where(
        and(
          eq(quickReplies.id, id),
          eq(quickReplies.userId, userId)
        )
      )
      .limit(1);
    
    if (!existingReply) {
      return null;
    }
    
    const [duplicatedReply] = await db.insert(quickReplies).values({
      userId,
      name: `${existingReply.name} (Copy)`,
      message: existingReply.message,
      topics: existingReply.topics,
      mediaAttachmentIds: [...existingReply.mediaAttachmentIds],
      isActive: existingReply.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return duplicatedReply;
  }
}