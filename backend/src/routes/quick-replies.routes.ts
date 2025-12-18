//backend/src/routes/quick-replies.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, inArray, sql } from 'drizzle-orm';

const router = Router();

// GET all quick replies
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      topics,
      isActive = true 
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = getDb();

    const whereConditions: any[] = [eq(quickReplies.userId, userId)];

    if (isActive !== undefined) {
      whereConditions.push(eq(quickReplies.isActive, isActive === 'true'));
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
      .limit(Number(limit))
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
        .map((id: string) => mediaAttachmentsMap[id])
        .filter(Boolean)
    }));

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(quickReplies)
      .where(and(...whereConditions));

    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      quickReplies: enrichedQuickReplies,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching quick replies:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch quick replies', 
      details: error.message 
    });
  }
});

// GET single quick reply
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const db = getDb();

    const quickReplyResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!quickReplyResult.length) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quick reply not found' 
      });
    }

    const quickReply = quickReplyResult[0];

    // Get media attachments if any
    let mediaAttachmentsList: any[] = [];
    if (quickReply.mediaAttachmentIds && quickReply.mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, quickReply.mediaAttachmentIds));
    }

    res.json({
      success: true,
      quickReply: {
        ...quickReply,
        mediaAttachments: mediaAttachmentsList
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch quick reply', 
      details: error.message 
    });
  }
});

// POST create quick reply
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, message, topics, mediaAttachmentIds, isActive } = req.body;
    const db = getDb();

    if (!name || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and message are required' 
      });
    }

    // Validate media attachments belong to user
    if (mediaAttachmentIds && mediaAttachmentIds.length > 0) {
      const validMediaAttachments = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, mediaAttachmentIds));

      if (validMediaAttachments.length !== mediaAttachmentIds.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'One or more media attachments not found' 
        });
      }
    }

    const [quickReply] = await db.insert(quickReplies).values({
      userId,
      name,
      message,
      topics: topics || 'General',
      mediaAttachmentIds: mediaAttachmentIds || [],
      isActive: isActive !== undefined ? isActive : true,
    }).returning();

    res.json({
      success: true,
      quickReply: {
        ...quickReply,
        mediaAttachments: mediaAttachmentIds || []
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create quick reply', 
      details: error.message 
    });
  }
});

// PUT update quick reply
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { name, message, topics, mediaAttachmentIds, isActive } = req.body;
    const db = getDb();

    // Check if quick reply exists and belongs to user
    const existingResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!existingResult.length) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quick reply not found' 
      });
    }

    // Validate media attachments belong to user
    if (mediaAttachmentIds && mediaAttachmentIds.length > 0) {
      const validMediaAttachments = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, mediaAttachmentIds));

      if (validMediaAttachments.length !== mediaAttachmentIds.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'One or more media attachments not found' 
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (message !== undefined) updateData.message = message;
    if (topics !== undefined) updateData.topics = topics;
    if (mediaAttachmentIds !== undefined) updateData.mediaAttachmentIds = mediaAttachmentIds;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    const [updatedQuickReply] = await db.update(quickReplies)
      .set(updateData)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .returning();

    res.json({
      success: true,
      quickReply: updatedQuickReply
    });
  } catch (error: any) {
    console.error('❌ Error updating quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update quick reply', 
      details: error.message 
    });
  }
});

// DELETE quick reply
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const db = getDb();

    const [deletedQuickReply] = await db.delete(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .returning();

    if (!deletedQuickReply) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quick reply not found' 
      });
    }

    res.json({
      success: true,
      message: 'Quick reply deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Error deleting quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete quick reply', 
      details: error.message 
    });
  }
});

export default router;