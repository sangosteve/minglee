// src/routes/tags.routes.ts - FIXED DUPLICATE CHECK
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { tags } from '../db/schema';
import { eq, desc } from 'drizzle-orm';


const router = Router();

// Get all tags for current user (simplified)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    
    // Get all tags for user
    const userTags = await db.select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(desc(tags.createdAt));
    
    res.json({
      success: true,
      tags: userTags.map(tag => ({
        ...tag,
        count: 0, // Placeholder for now
        conversationCount: 0,
        contactCount: 0,
      })),
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching tags:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch tags',
      details: error.message 
    });
  }
});

// Create new tag - FIXED VERSION
router.post('/', authenticate, async (req: AuthRequest, res) => {
  let transaction;
  try {
    console.log('Creating tag - Request body:', req.body);
    
    const { name, color, description } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      });
    }
    
    const db = getDb();
    const userId = req.user!.userId;
    const tagName = name.trim();
    
    // FIRST: Check if tag with same name already exists for this user
    // Use transaction to ensure consistency
    const existingTags = await db.select()
      .from(tags)
      .where(eq(tags.userId, userId));
    
    console.log('Existing tags for user:', existingTags.length);
    
    const duplicateTag = existingTags.find(tag => 
      tag.name.toLowerCase() === tagName.toLowerCase()
    );
    
    if (duplicateTag) {
      console.log('Duplicate tag found:', duplicateTag);
      return res.status(409).json({
        success: false,
        error: 'Tag with this name already exists'
      });
    }
    
    // Create the tag
    const [newTag] = await db.insert(tags).values({
      name: tagName,
      description: description || '',
      color: color || '#3B82F6',
      userId: userId,
    }).returning();
    
    console.log('Created new tag:', newTag);
    
    res.json({
      success: true,
      tag: {
        ...newTag,
        count: 0,
        conversationCount: 0,
        contactCount: 0
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error creating tag:', error);
    
    // Check for unique constraint violation
    if (error.code === '23505' || error.message?.includes('unique constraint')) {
      return res.status(409).json({
        success: false,
        error: 'Tag with this name already exists'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create tag',
      details: error.message 
    });
  }
});

// Update tag
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      });
    }
    
    const db = getDb();
    const userId = req.user!.userId;
    const tagName = name.trim();
    
    // Check if tag exists and belongs to user
    const existingTag = await db.select()
      .from(tags)
      .where(
        eq(tags.id, id)
      )
      .where(eq(tags.userId, userId))
      .limit(1);
    
    if (existingTag.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }
    
    // Check if another tag with same name already exists (excluding current tag)
    const allUserTags = await db.select()
      .from(tags)
      .where(eq(tags.userId, userId));
    
    const duplicateTag = allUserTags.find(tag => 
      tag.id !== id && tag.name.toLowerCase() === tagName.toLowerCase()
    );
    
    if (duplicateTag) {
      return res.status(409).json({
        success: false,
        error: 'Another tag with this name already exists'
      });
    }
    
    const [updatedTag] = await db.update(tags)
      .set({
        name: tagName,
        description: description || existingTag[0].description || '',
        color: color || existingTag[0].color,
        updatedAt: new Date(),
      })
      .where(eq(tags.id, id))
      .where(eq(tags.userId, userId))
      .returning();
    
    res.json({
      success: true,
      tag: updatedTag
    });
    
  } catch (error: any) {
    console.error('❌ Error updating tag:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update tag',
      details: error.message 
    });
  }
});

// Delete tag
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const db = getDb();
    const userId = req.user!.userId;
    
    // Check if tag exists and belongs to user
    const existingTag = await db.select()
      .from(tags)
      .where(eq(tags.id, id))
      .where(eq(tags.userId, userId))
      .limit(1);
    
    if (existingTag.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }
    
    // Delete the tag
    await db.delete(tags)
      .where(eq(tags.id, id))
      .where(eq(tags.userId, userId));
    
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Error deleting tag:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete tag',
      details: error.message 
    });
  }
});

// Debug endpoint to see all tags
router.get('/debug/all', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    
    const allTags = await db.select().from(tags);
    const userTags = await db.select()
      .from(tags)
      .where(eq(tags.userId, userId));
    
    res.json({
      success: true,
      allTagsInDatabase: allTags,
      userTags: userTags,
      userId: userId,
      message: 'Debug info'
    });
    
  } catch (error: any) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;