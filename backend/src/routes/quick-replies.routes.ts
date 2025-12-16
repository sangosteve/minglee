//backend/src/routes/quick-replies.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { QuickRepliesService } from '../services/quick-replies.service';
import  upload  from '../middleware/multer.middleware';
import { CloudinaryService } from '../services/cloudinary.service';

const router = Router();

// GET /api/quick-replies - Get all quick replies for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      topics,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const userId = req.user!.userId;
    
    const filters = {
      page: Number(page),
      limit: Number(limit),
      search: search as string,
      topics: topics ? (Array.isArray(topics) ? topics as string[] : [topics as string]) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };
    
    const result = await QuickRepliesService.getQuickReplies(userId, filters);
    
    res.json({
      success: true,
      quickReplies: result.replies,
      pagination: result.pagination,
    });
    
  } catch (error: any) {
    console.error('Error fetching quick replies:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch quick replies' 
    });
  }
});

// GET /api/quick-replies/:id - Get single quick reply
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const quickReply = await QuickRepliesService.getQuickReplyById(userId, id);
    
    if (!quickReply) {
      return res.status(404).json({ 
        success: false,
        error: 'Quick reply not found' 
      });
    }
    
    res.json({
      success: true,
      quickReply,
    });
    
  } catch (error: any) {
    console.error('Error fetching quick reply:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch quick reply' 
    });
  }
});

// POST /api/quick-replies - Create new quick reply
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      message,
      topics = 'General',
      mediaAttachmentIds = [],
      isActive = true,
    } = req.body;
    
    const userId = req.user!.userId;
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Name is required' 
      });
    }
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }
    
    const quickReply = await QuickRepliesService.createQuickReply(userId, {
      name: name.trim(),
      message: message.trim(),
      topics: topics.trim(),
      mediaAttachmentIds,
      isActive,
    });
    
    res.status(201).json({
      success: true,
      quickReply,
    });
    
  } catch (error: any) {
    console.error('Error creating quick reply:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create quick reply' 
    });
  }
});

// POST /api/quick-replies/:id/duplicate - Duplicate quick reply
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const duplicatedQuickReply = await QuickRepliesService.duplicateQuickReply(userId, id);
    
    if (!duplicatedQuickReply) {
      return res.status(404).json({ 
        success: false,
        error: 'Quick reply not found' 
      });
    }
    
    res.json({
      success: true,
      quickReply: duplicatedQuickReply,
    });
    
  } catch (error: any) {
    console.error('Error duplicating quick reply:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to duplicate quick reply' 
    });
  }
});

// POST /api/quick-replies/:id/upload - Upload attachment for quick reply
router.post('/:id/upload', authenticate, upload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files provided' 
      });
    }
    
    // Check if quick reply exists and belongs to user
    const quickReply = await QuickRepliesService.getQuickReplyById(userId, id);
    if (!quickReply) {
      return res.status(404).json({ 
        success: false,
        error: 'Quick reply not found' 
      });
    }
    
    // Upload files to Cloudinary
    const uploadPromises = files.map(file => 
      CloudinaryService.uploadFile(file, { folder: 'quick-replies', userId })
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    
    // Create media attachment records
    const mediaAttachments = [];
    for (const result of uploadResults) {
      if (result.success && result.data) {
        const mediaAttachment = await CloudinaryService.saveMediaAttachment({
          ...result.data,
          uploadedByUserId: userId,
          messageId: null,
        });
        mediaAttachments.push(mediaAttachment);
      }
    }
    
    // Get existing media attachment IDs
    const existingMediaAttachmentIds = quickReply.mediaAttachmentIds || [];
    const newMediaAttachmentIds = [
      ...existingMediaAttachmentIds,
      ...mediaAttachments.map(ma => ma.id)
    ];
    
    // Update quick reply with new media attachment IDs
    const updatedQuickReply = await QuickRepliesService.updateQuickReply(userId, id, {
      mediaAttachmentIds: newMediaAttachmentIds,
    });
    
    res.json({
      success: true,
      quickReply: updatedQuickReply,
      mediaAttachments,
    });
    
  } catch (error: any) {
    console.error('Error uploading attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload attachments' 
    });
  }
});

// PUT /api/quick-replies/:id - Update quick reply
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const {
      name,
      message,
      topics,
      mediaAttachmentIds,
      isActive,
    } = req.body;
    
    const updatedQuickReply = await QuickRepliesService.updateQuickReply(userId, id, {
      name,
      message,
      topics,
      mediaAttachmentIds,
      isActive,
    });
    
    if (!updatedQuickReply) {
      return res.status(404).json({ 
        success: false,
        error: 'Quick reply not found' 
      });
    }
    
    res.json({
      success: true,
      quickReply: updatedQuickReply,
    });
    
  } catch (error: any) {
    console.error('Error updating quick reply:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update quick reply' 
    });
  }
});

// DELETE /api/quick-replies/:id - Delete quick reply
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const success = await QuickRepliesService.deleteQuickReply(userId, id);
    
    if (!success) {
      return res.status(404).json({ 
        success: false,
        error: 'Quick reply not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Quick reply deleted successfully',
    });
    
  } catch (error: any) {
    console.error('Error deleting quick reply:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete quick reply' 
    });
  }
});

// GET /api/quick-replies/topics - Get all topics
router.get('/topics/all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const topics = await QuickRepliesService.getTopics(userId);
    
    res.json({
      success: true,
      topics,
    });
    
  } catch (error: any) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch topics' 
    });
  }
});

export default router;