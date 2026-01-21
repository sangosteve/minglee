import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { broadcastService } from '../services/broadcast.service';
import { getDb } from '../db/client';
import { contacts, tags } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/broadcasts - Get all broadcasts
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    const userId = req.user!.userId;
    
    const result = await broadcastService.getBroadcasts(userId, {
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch broadcasts',
      details: error.message 
    });
  }
});

// GET /api/broadcasts/stats - Get broadcast statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await broadcastService.getBroadcastStats(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching broadcast stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch broadcast stats',
      details: error.message 
    });
  }
});

// GET /api/broadcasts/audience/tags - Get tags for audience selection
router.get('/audience/tags', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    
    const tagsList = await db.select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);
    
    // Get contact count for each tag
    const tagsWithCounts = await Promise.all(
      tagsList.map(async (tag) => {
        const contactCount = await db.execute(`
          SELECT COUNT(*) as count
          FROM contacts
          WHERE user_id = $1
          AND opt_in = true
          AND status = 'active'
          AND tag_ids @> ARRAY[$2]::uuid[]
        `, [userId, tag.id]);
        
        return {
          ...tag,
          contactCount: Number(contactCount.rows[0]?.count || 0),
        };
      })
    );
    
    res.json({
      success: true,
      data: tagsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tags',
      details: error.message 
    });
  }
});

// POST /api/broadcasts - Create new broadcast
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    console.log('Creating broadcast with data:', req.body);
    
    // Manual validation (bypassing Zod for now)
    const data = req.body;
    
    // Required fields validation
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Broadcast name is required',
      });
    }
    
    if (!data.audienceType || !['all', 'tags', 'segments', 'contacts'].includes(data.audienceType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid audience type is required',
      });
    }
    
    if (!data.scheduleType || !['now', 'scheduled'].includes(data.scheduleType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid schedule type is required',
      });
    }
    
    // Prepare validated data
    const validatedData = {
      name: data.name.trim(),
      templateId: data.templateId,
      audienceType: data.audienceType,
      audienceFilter: data.audienceFilter || {},
      variables: data.variables || {},
      mediaUrl: data.mediaUrl || '',
      scheduleType: data.scheduleType,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      message: data.message,
      mediaAttachmentId: data.mediaAttachmentId,
    };
    
    console.log('Validated data:', validatedData);
    
    const result = await broadcastService.createBroadcast(userId, validatedData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating broadcast:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create broadcast',
      details: error.message 
    });
  }
});

// GET /api/broadcasts/:id - Get broadcast by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await broadcastService.getBroadcast(userId, broadcastId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch broadcast',
      details: error.message 
    });
  }
});

// PUT /api/broadcasts/:id - Update broadcast
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user!.userId;
    
    // Simple validation
    const data = req.body;
    
    const result = await broadcastService.updateBroadcast(userId, broadcastId, data);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error updating broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update broadcast',
      details: error.message 
    });
  }
});

// POST /api/broadcasts/:id/start - Start/send broadcast
router.post('/:id/start', async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await broadcastService.startBroadcast(broadcastId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error starting broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start broadcast',
      details: error.message 
    });
  }
});

// POST /api/broadcasts/:id/pause - Pause broadcast
router.post('/:id/pause', async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await broadcastService.updateBroadcast(userId, broadcastId, {
      status: 'paused',
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error pausing broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to pause broadcast',
      details: error.message 
    });
  }
});

// DELETE /api/broadcasts/:id - Delete broadcast
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await broadcastService.deleteBroadcast(userId, broadcastId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete broadcast',
      details: error.message 
    });
  }
});

export default router;