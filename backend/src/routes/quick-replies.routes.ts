// backend/src/routes/quick-replies.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, inArray, sql } from 'drizzle-orm';

const router = Router();

// Helper function to create media attachment using existing media routes logic
const createMediaAttachment = async (
  userId: string, 
  fileData: any, 
  quickReplyId?: string
) => {
  const db = getDb();
  
  // Extract file data
  const { 
    originalname, 
    mimetype, 
    size, 
    buffer, 
    url, 
    secureUrl, 
    publicId 
  } = fileData;

  // Create media attachment record
  const [mediaAttachment] = await db.insert(mediaAttachments).values({
    messageId: null, // Quick reply media have null messageId
    uploadedByUserId: userId,
    publicId: publicId || `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    secureUrl: secureUrl || url,
    thumbnailUrl: secureUrl || url,
    originalFilename: originalname,
    mimeType: mimetype,
    fileSize: size,
    format: originalname.split('.').pop(),
    resourceType: mimetype.startsWith('image/') ? 'image' : 
                 mimetype.startsWith('video/') ? 'video' : 
                 mimetype.startsWith('audio/') ? 'video' : 'raw', // Cloudinary treats audio as video
    tags: ['quick_reply', quickReplyId ? `quick_reply_${quickReplyId}` : ''],
    caption: originalname,
    status: 'active',
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return mediaAttachment;
};

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
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      topics,
      isActive = 'true' // Default to active
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

// GET single quick reply by ID
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

// GET all unique topics for quick replies
router.get('/topics/all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
    const { name, message, topics, mediaAttachmentIds = [], isActive } = req.body;
    const db = getDb();

    if (!name || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and message are required' 
      });
    }

    // Validate media attachments belong to user
    if (mediaAttachmentIds && mediaAttachmentIds.length > 0) {
      const validMediaAttachments = await validateMediaAttachments(mediaAttachmentIds, userId);

      if (validMediaAttachments.length !== mediaAttachmentIds.length) {
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
      mediaAttachmentIds: mediaAttachmentIds || [],
      isActive: isActive !== undefined ? isActive : true,
    }).returning();

    // Update media attachments with quick reply tag
    if (mediaAttachmentIds.length > 0) {
      for (const attachmentId of mediaAttachmentIds) {
        const [attachment] = await db.select()
          .from(mediaAttachments)
          .where(eq(mediaAttachments.id, attachmentId))
          .limit(1);
        
        if (attachment) {
          const updatedTags = [...(attachment.tags || []), `quick_reply_${quickReply.id}`];
          
          await db.update(mediaAttachments)
            .set({
              tags: updatedTags,
              updatedAt: new Date(),
            })
            .where(eq(mediaAttachments.id, attachmentId));
        }
      }
    }

    // Get media attachments for response
    let mediaAttachmentsList: any[] = [];
    if (mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await validateMediaAttachments(mediaAttachmentIds, userId);
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
    const userId = req.user!.userId;
    const db = getDb();

    // Get original quick reply
    const originalResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, id),
        eq(quickReplies.userId, userId)
      ))
      .limit(1);

    if (!originalResult.length) {
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
      const validMediaAttachments = await validateMediaAttachments(mediaAttachmentIds, userId);

      if (validMediaAttachments.length !== mediaAttachmentIds.length) {
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

    // Update media attachments with quick reply tag
    if (mediaAttachmentIds && mediaAttachmentIds.length > 0) {
      for (const attachmentId of mediaAttachmentIds) {
        const [attachment] = await db.select()
          .from(mediaAttachments)
          .where(eq(mediaAttachments.id, attachmentId))
          .limit(1);
        
        if (attachment) {
          const updatedTags = [...(attachment.tags || []), `quick_reply_${id}`];
          
          await db.update(mediaAttachments)
            .set({
              tags: updatedTags,
              updatedAt: new Date(),
            })
            .where(eq(mediaAttachments.id, attachmentId));
        }
      }
    }

    // Get media attachments for response
    let mediaAttachmentsList: any[] = [];
    if (mediaAttachmentIds && mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await validateMediaAttachments(mediaAttachmentIds, userId);
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