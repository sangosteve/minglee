import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { tags } from '../db/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

const router = Router();

// Get all tags for current user (simplified)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    
    // Build where conditions
    const conditions = [eq(tags.userId, userId)];
    
    if (search) {
      conditions.push(
        sql`LOWER(${tags.name}) LIKE LOWER(${'%' + search + '%'})`
      );
    }
    
    // Build query
    const query = db.select()
      .from(tags)
      .where(and(...conditions));
    
    // Apply sorting
    const sortField = {
      'name': tags.name,
      'createdAt': tags.createdAt,
      'updatedAt': tags.updatedAt,
    }[sortBy as string] || tags.createdAt;
    
    const sortedQuery = query.orderBy(
      sortOrder === 'desc' ? desc(sortField) : asc(sortField)
    );
    
    // Get paginated results
    const tagsList = await sortedQuery
      .limit(Number(limit))
      .offset(offset);
    
    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(and(...conditions));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;
    
    // Get counts for each tag
    const enhancedTags = await Promise.all(
      tagsList.map(async (tag) => {
        // Get contact count for this tag
        const contactsWithTag = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM contacts
          WHERE ${tag.id} = ANY(contacts.tag_ids)
          AND contacts.user_id = ${userId}
        `);
        
        const contactCount = contactsWithTag.rows[0]?.count || 0;
        
        return {
          ...tag,
          count: Number(contactCount),
          contactCount: Number(contactCount),
          conversationCount: 0, // You can add this if needed
        };
      })
    );
    
    res.json({
      success: true,
      tags: enhancedTags,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch tags' 
    });
  }
});

// Create new tag - FIXED VERSION
router.post('/', authenticate, async (req: AuthRequest, res) => {
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
        and(
          eq(tags.id, id),
          eq(tags.userId, userId)
        )
      )
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
      .where(
        and(
          eq(tags.id, id),
          eq(tags.userId, userId)
        )
      )
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
      .where(
        and(
          eq(tags.id, id),
          eq(tags.userId, userId)
        )
      )
      .limit(1);
    
    if (existingTag.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }
    
    // Delete the tag
    await db.delete(tags)
      .where(
        and(
          eq(tags.id, id),
          eq(tags.userId, userId)
        )
      );
    
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