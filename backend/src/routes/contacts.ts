// backend/src/routes/contacts.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { contacts, tags, conversations } from '../db/schema';
import { eq, and, or, like, inArray, desc, asc, sql } from 'drizzle-orm';
import { getContactsOverview } from '../services/analytics.service';

const router = Router();

// GET /api/contacts - Get all contacts for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status, 
      tags, 
      city,
      country,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    
    // Build where conditions
    const conditions = [eq(contacts.userId, userId)];
    
    if (search) {
      conditions.push(
        or(
          like(contacts.name, `%${search}%`),
          like(contacts.phone, `%${search}%`),
          like(contacts.email, `%${search}%`)
        )
      );
    }
    
    if (status) {
      conditions.push(eq(contacts.status, String(status)));
    }
    
    if (tags) {
      // Tag filtering disabled for now - use POST /contacts/:id/tags instead
      console.log('⚠️ Tag filtering not yet implemented for list endpoint');
    }
    
    if (city) {
      conditions.push(eq(contacts.city, String(city)));
    }
    
    if (country) {
      conditions.push(eq(contacts.country, String(country)));
    }
    
    // Build query
    const query = db.select()
      .from(contacts)
      .where(and(...conditions));
    
    // Apply sorting
    const sortField = {
      'name': contacts.name,
      'phone': contacts.phone,
      'email': contacts.email,
      'city': contacts.city,
      'country': contacts.country,
      'status': contacts.status,
      'lastContactedAt': contacts.lastContactedAt,
      'createdAt': contacts.createdAt,
      'updatedAt': contacts.updatedAt,
    }[sortBy as string] || contacts.createdAt;
    
    const sortedQuery = query.orderBy(
      sortOrder === 'desc' ? desc(sortField) : asc(sortField)
    );
    
    // Get paginated results
    const contactsList = await sortedQuery
      .limit(Number(limit))
      .offset(offset);
    
    // Fetch conversation counts for contacts on this page (single query)
    const contactIds = contactsList.map(c => c.id).filter(Boolean);
    let convoCounts: Record<string, number> = {};
    if (contactIds.length > 0) {
      const convoRaw = await db.select({ contactId: conversations.contactId, count: sql`count(*)` })
        .from(conversations)
        .where(inArray(conversations.contactId, contactIds))
        .groupBy(conversations.contactId);
      for (const r of convoRaw) {
        convoCounts[String(r.contactId)] = Number((r as any).count || 0);
      }
    }

    // Attach conversationCount to each contact
    const contactsWithCounts = contactsList.map(c => ({
      ...c,
      conversationCount: convoCounts[c.id] || 0,
    }));
    
    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(contacts)
      .where(and(...conditions));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      contacts: contactsWithCounts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch contacts' 
    });
  }
});

// GET /api/contacts/analytics - Get contact analytics
router.get('/analytics', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    
    // Get counts by status
    const statusCounts = await db.select({
      status: contacts.status,
      count: sql`count(*)`,
    })
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .groupBy(contacts.status);
    
    // Get counts by city (non-empty cities only)
    const cityCounts = await db.select({
      city: contacts.city,
      count: sql`count(*)`,
    })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          sql`${contacts.city} != ''`
        )
      )
      .groupBy(contacts.city)
      .orderBy(contacts.city)
      .limit(10);
    
    // Get tag counts (using tag_ids array)
    const tagCounts = await db.execute(sql`
      SELECT tag, COUNT(*) as count
      FROM contacts, unnest(tag_ids) as tag
      WHERE user_id = ${userId}
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Get new contacts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonthResult = await db.select({ 
      count: sql`count(*)` 
    })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          sql`${contacts.createdAt} >= ${startOfMonth}`
        )
      );
    
    const newThisMonth = newThisMonthResult[0]?.count || 0;
    
    res.json({
      success: true,
      analytics: {
        byStatus: statusCounts,
        byCity: cityCounts,
        byTag: tagCounts.rows || [],
        newThisMonth: Number(newThisMonth),
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching contact analytics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch analytics' 
    });
  }
});

// NEW: GET /api/contacts/analytics/overview - Provide summary analytics used by frontend
import { getContactsOverview } from '../services/analytics.service';
router.get('/analytics/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Delegate to shared service to avoid raw SQL pitfalls
    const analytics = await getContactsOverview(userId);

    res.json({
      success: true,
      analytics,
    });

  } catch (error: any) {
    console.error('Error fetching contact analytics overview (legacy route):', error.message || error, error.stack || '');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact analytics'
    });
  }
});

// GET /api/contacts/:id - Get single contact
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const db = getDb();
    
    const contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (contactResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }
    
    // Add full tag objects to response
    let tagDetails = [];
    if (contactResult[0].tagIds && contactResult[0].tagIds.length > 0) {
      tagDetails = await db.select()
        .from(tags)
        .where(
          and(
            inArray(tags.id, contactResult[0].tagIds),
            eq(tags.userId, userId)
          )
        );
    }

    res.json({
      success: true,
      contact: {
        ...contactResult[0],
        tags: tagDetails,
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch contact' 
    });
  }
});

// POST /api/contacts - Create contact
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      country,
      postalCode,
      note,
      tags,
      status,
    } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }
    
    const db = getDb();
    const userId = req.user!.userId;
    
    // Format phone
    const formattedPhone = phone.replace(/\D/g, '');
    
    // Check if contact already exists
    const existingContact = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, formattedPhone),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (existingContact.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Contact with this phone number already exists',
      });
    }
    
    // Create contact
    const [newContact] = await db.insert(contacts).values({
      name: name || `Contact ${formattedPhone}`,
      phone: formattedPhone,
      email: email || '',
      address: address || '',
      city: city || '',
      state: state || '',
      country: country || '',
      postalCode: postalCode || '',
      note: note || '',
      userId,
      tags: tags || [],
      status: status || 'active',
      source: 'manual',
      isActive: true,
      optIn: true,
    }).returning();
    
    res.json({
      success: true,
      contact: newContact,
    });
    
  } catch (error: any) {
    console.error('Error creating contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create contact' 
    });
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user!.userId;
    
    const db = getDb();
    
    // Check if contact exists and belongs to user
    const contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (contactResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }
    
    // Format phone if provided
    if (updates.phone) {
      updates.phone = updates.phone.replace(/\D/g, '');
    }

    // If tags provided in updates, validate they exist for this user and normalize
    if (typeof updates.tags !== 'undefined') {
      console.log('🔄 Processing tags update:', updates.tags);
      if (Array.isArray(updates.tags)) {
        if (updates.tags.length > 0) {
          const existingTags = await db.select()
            .from(tags)
            .where(
              and(
                inArray(tags.id, updates.tags),
                eq(tags.userId, userId)
              )
            );
          const validTagIds = existingTags.map(t => t.id);
          console.log('✅ Valid tag IDs for update:', validTagIds);
          updates.tagIds = validTagIds;
        } else {
          updates.tagIds = [];
        }
      } else {
        // If tags is not an array, ignore the field
        updates.tagIds = [];
      }
    }

    // Update contact
    const [updatedContact] = await db.update(contacts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    res.json({
      success: true,
      contact: updatedContact,
    });
    
  } catch (error: any) {
    console.error('Error updating contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update contact' 
    });
  }
});

// POST /api/contacts/:id/tags - Add tags to contact
router.post('/:id/tags', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { tags: tagIds } = req.body; // Expecting array of tag UUIDs
    const userId = req.user!.userId;
    const db = getDb();
    
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ 
        success: false,
        error: 'Tags array is required' 
      });
    }
    
    // Check if contact exists and belongs to user
    const contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (contactResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found' 
      });
    }
    
    // Validate that all tag IDs exist and belong to the user
    const existingTags = await db.select()
      .from(tags)
      .where(
        and(
          inArray(tags.id, tagIds),
          eq(tags.userId, userId)
        )
      );
    
    const validTagIds = existingTags.map(tag => tag.id);
    const currentTagIds = contactResult[0].tagIds || [];
    const newTagIds = [...new Set([...currentTagIds, ...validTagIds])];
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tagIds: newTagIds,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    res.json({
      success: true,
      contact: updatedContact,
    });
    
  } catch (error: any) {
    console.error('Error adding tags to contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add tags' 
    });
  }
});

// DELETE /api/contacts/:id/tags - Remove tags from contact
router.delete('/:id/tags', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { tags: tagIds } = req.body; // Expecting array of tag UUIDs to remove
    const userId = req.user!.userId;
    const db = getDb();
    
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ 
        success: false,
        error: 'Tags array is required' 
      });
    }
    
    // Check if contact exists and belongs to user
    const contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (contactResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found' 
      });
    }
    
    const currentTagIds = contactResult[0].tagIds || [];
    const newTagIds = currentTagIds.filter(tagId => !tagIds.includes(tagId));
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tagIds: newTagIds,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    res.json({
      success: true,
      contact: updatedContact,
    });
    
  } catch (error: any) {
    console.error('Error removing tags from contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove tags' 
    });
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const db = getDb();
    
    // Delete contact
    const result = await db.delete(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      );
    
    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
    
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete contact' 
    });
  }
});

export default router;