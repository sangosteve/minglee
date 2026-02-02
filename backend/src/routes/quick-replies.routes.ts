// backend/src/routes/quick-replies.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, inArray, sql } from 'drizzle-orm';

const router = Router();

// Helper function to validate media attachments
const validateMediaAttachments = async (attachmentIds: string[], userId: string) => {
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
};

// ==================== GET ENDPOINTS ====================

// GET all quick replies (with pagination and filters)
// GET all quick replies (with pagination and filters)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      search, 
      topics,
      isActive = 'true'
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    const db = getDb();

    // Start with base condition
    const whereConditions = [eq(quickReplies.userId, userId)];

    // Add isActive condition
    whereConditions.push(eq(quickReplies.isActive, isActive === 'true'));

    // Add search condition if provided
    if (search && typeof search === 'string') {
      const searchPattern = `%${search}%`;
      const searchConditions = [
        like(quickReplies.name, searchPattern),
        like(quickReplies.message, searchPattern),
        like(quickReplies.topics, searchPattern)
      ].filter(Boolean) as any[];
      
      if (searchConditions.length > 0) {
        const orCondition = or(...searchConditions);
        if (orCondition) { // Check if orCondition is not undefined
          whereConditions.push(orCondition);
        }
      }
    }

    // Add topics condition if provided
    if (topics && typeof topics === 'string') {
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
      .filter(Boolean) as string[];

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
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(quickReplies)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0;

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

// GET single quick reply by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    // Check if id is defined
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quick reply ID is required' 
      });
    }

    const db = getDb();

    const quickReplyResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!quickReplyResult.length || !quickReplyResult[0]) {
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

// GET all unique topics for quick replies
router.get('/topics/all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const db = getDb();

    // Get all quick replies for the user
    const allQuickReplies = await db.select({ topics: quickReplies.topics })
      .from(quickReplies)
      .where(eq(quickReplies.userId, userId));

    // Extract and deduplicate topics
    const allTopics = new Set<string>();
    allQuickReplies.forEach(reply => {
      if (reply.topics) {
        // Split topics by comma and trim
        const topicsArray = reply.topics.split(',').map((t: string) => t.trim());
        topicsArray.forEach(topic => {
          if (topic) allTopics.add(topic);
        });
      }
    });

    // Convert to array and sort
    const topicsArray = Array.from(allTopics).sort();

    res.json({
      success: true,
      topics: topicsArray
    });
  } catch (error: any) {
    console.error('❌ Error fetching topics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch topics', 
      details: error.message 
    });
  }
});

// ==================== POST ENDPOINTS ====================

// POST create quick reply
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const { name, message, topics, mediaAttachmentIds = [], isActive } = req.body;
    const db = getDb();

    if (!name || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and message are required' 
      });
    }

    // Validate media attachments belong to user
    const validatedAttachmentIds = mediaAttachmentIds || [];
    if (validatedAttachmentIds.length > 0) {
      const validMediaAttachments = await validateMediaAttachments(validatedAttachmentIds, userId);

      if (validMediaAttachments.length !== validatedAttachmentIds.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'One or more media attachments not found or do not belong to user' 
        });
      }
    }

    // Create quick reply
    const [quickReply] = await db.insert(quickReplies).values({
      userId,
      name,
      message,
      topics: topics || 'General',
      mediaAttachmentIds: validatedAttachmentIds,
      isActive: isActive !== undefined ? isActive : true,
    }).returning();

    // Update media attachments with quick reply tag
    if (validatedAttachmentIds.length > 0 && quickReply) {
      for (const attachmentId of validatedAttachmentIds) {
        const attachmentResult = await db.select()
          .from(mediaAttachments)
          .where(eq(mediaAttachments.id, attachmentId))
          .limit(1);
        
        const attachment = attachmentResult[0];
        if (attachment) {
          const currentTags = attachment.tags || [];
          const updatedTags = [...currentTags, `quick_reply_${quickReply.id}`];
          
          await db.update(mediaAttachments)
            .set({
              tags: updatedTags,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(mediaAttachments.id, attachmentId));
        }
      }
    }

    // Get media attachments for response
    let mediaAttachmentsList: any[] = [];
    if (validatedAttachmentIds.length > 0) {
      mediaAttachmentsList = await validateMediaAttachments(validatedAttachmentIds, userId);
    }

    res.json({
      success: true,
      quickReply: {
        ...quickReply,
        mediaAttachments: mediaAttachmentsList
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

// POST duplicate quick reply
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    // Check if id is defined
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quick reply ID is required' 
      });
    }

    const db = getDb();

    // Get original quick reply
    const originalResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!originalResult.length || !originalResult[0]) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quick reply not found' 
      });
    }

    const original = originalResult[0];

    // Create duplicate with "Copy" appended to name
    const [duplicated] = await db.insert(quickReplies).values({
      userId,
      name: `${original.name} (Copy)`,
      message: original.message,
      topics: original.topics,
      mediaAttachmentIds: original.mediaAttachmentIds || [],
      isActive: original.isActive,
    }).returning();

    res.json({
      success: true,
      quickReply: duplicated
    });
  } catch (error: any) {
    console.error('❌ Error duplicating quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to duplicate quick reply', 
      details: error.message 
    });
  }
});

// ==================== PUT ENDPOINTS ====================

// PUT update quick reply
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    // Check if id is defined
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quick reply ID is required' 
      });
    }

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

    if (!existingResult.length || !existingResult[0]) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quick reply not found' 
      });
    }

    // Validate media attachments belong to user
    const validatedAttachmentIds = mediaAttachmentIds || [];
    if (validatedAttachmentIds.length > 0) {
      const validMediaAttachments = await validateMediaAttachments(validatedAttachmentIds, userId);

      if (validMediaAttachments.length !== validatedAttachmentIds.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'One or more media attachments not found or do not belong to user' 
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (message !== undefined) updateData.message = message;
    if (topics !== undefined) updateData.topics = topics;
    if (mediaAttachmentIds !== undefined) updateData.mediaAttachmentIds = validatedAttachmentIds;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date().toISOString();

    const [updatedQuickReply] = await db.update(quickReplies)
      .set(updateData)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .returning();

    // Update media attachments with quick reply tag
    if (validatedAttachmentIds.length > 0 && updatedQuickReply) {
      for (const attachmentId of validatedAttachmentIds) {
        const attachmentResult = await db.select()
          .from(mediaAttachments)
          .where(eq(mediaAttachments.id, attachmentId))
          .limit(1);
        
        const attachment = attachmentResult[0];
        if (attachment) {
          const currentTags = attachment.tags || [];
          const updatedTags = [...currentTags, `quick_reply_${id}`];
          
          await db.update(mediaAttachments)
            .set({
              tags: updatedTags,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(mediaAttachments.id, attachmentId));
        }
      }
    }

    // Get media attachments for response
    let mediaAttachmentsList: any[] = [];
    if (validatedAttachmentIds.length > 0) {
      mediaAttachmentsList = await validateMediaAttachments(validatedAttachmentIds, userId);
    }

    res.json({
      success: true,
      quickReply: {
        ...updatedQuickReply,
        mediaAttachments: mediaAttachmentsList
      }
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

// ==================== DELETE ENDPOINTS ====================

// DELETE quick reply
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    // Check if id is defined
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quick reply ID is required' 
      });
    }

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