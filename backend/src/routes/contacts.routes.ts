// backend/src/routes/contacts.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { contacts, tags } from '../db/schema';
import { eq, and, or, like, inArray, desc, asc, sql } from 'drizzle-orm';

const router = Router();

// Helper function to get tag details
async function getTagsWithDetails(tagIds: string[], userId: string) {
  if (!tagIds || tagIds.length === 0) return [];
  
  const db = getDb();
  const tagDetails = await db.select()
    .from(tags)
    .where(
      and(
        inArray(tags.id, tagIds),
        eq(tags.userId, userId)
      )
    );
  
  return tagDetails;
}

// GET /api/contacts - Get all contacts for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status, 
      tags: tagIds, 
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
    
    // Handle tag filtering by tag IDs
    if (tagIds) {
      const tagArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      conditions.push(sql`${contacts.tagIds} && ARRAY[${sql.join(tagArray.map(tag => sql`${tag}::uuid`), sql`, `)}]`);
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
    
    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(...conditions));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;
    
    // Enhance contacts with tag details
    const enhancedContacts = await Promise.all(
      contactsList.map(async (contact) => {
        let tagDetails = [];
        if (contact.tagIds && contact.tagIds.length > 0) {
          tagDetails = await getTagsWithDetails(contact.tagIds, userId);
        }
        return {
          ...contact,
          tags: tagDetails, // Add full tag objects
        };
      })
    );
    
    res.json({
      success: true,
      contacts: enhancedContacts,
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
        error: 'Contact not found' 
      });
    }
    
    const contact = contactResult[0];
    
    // Get tag details
    let tagDetails = [];
    if (contact.tagIds && contact.tagIds.length > 0) {
      tagDetails = await getTagsWithDetails(contact.tagIds, userId);
    }
    
    res.json({
      success: true,
      contact: {
        ...contact,
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

// POST /api/contacts - Create new contact
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      phone,
      email,
      city,
      state,
      country,
      status = 'active',
      tags: tagIds = [], // Expecting array of tag IDs (UUIDs)
      metadata = {},
      note,
      source = 'manual'
    } = req.body;
    
    const userId = req.user!.userId;
    const db = getDb();
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'Name is required' 
      });
    }
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone is required' 
      });
    }
    
    // Check if contact already exists for this user
    const existingContact = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, phone),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    if (existingContact.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact with this phone number already exists' 
      });
    }
    
    // Validate that all tag IDs exist and belong to the user
    let validTagIds: string[] = [];
    if (tagIds && tagIds.length > 0) {
      const tagArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      
      // Check if tags exist and belong to user
      const existingTags = await db.select()
        .from(tags)
        .where(
          and(
            inArray(tags.id, tagArray),
            eq(tags.userId, userId)
          )
        );
      
      // Only use valid tag IDs that exist
      validTagIds = existingTags.map(tag => tag.id);
    }
    
    // Create contact
    const [newContact] = await db.insert(contacts).values({
      name,
      phone,
      email: email || '',
      city: city || '',
      state: state || '',
      country: country || '',
      status,
      tagIds: validTagIds, // Store array of tag UUIDs
      metadata,
      note: note || '',
      userId,
      source,
      isActive: true,
      optIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // Get tag details for response
    let tagDetails = [];
    if (validTagIds.length > 0) {
      tagDetails = await getTagsWithDetails(validTagIds, userId);
    }
    
    res.status(201).json({
      success: true,
      contact: {
        ...newContact,
        tags: tagDetails, // Include full tag objects in response
      },
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
router.put("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    console.log("🎯 PUT /contacts/:id - START");
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    const {
      name,
      phone,
      email,
      city,
      state,
      country,
      status,
      tags: tagIds, // tag IDs from request body (array of UUIDs)
      metadata,
      note,
      isActive,
      optIn,
    } = req.body;

    console.log("🔍 DEBUG - Received tagIds field:", tagIds);
    console.log("🔍 DEBUG - Is array?", Array.isArray(tagIds));

    const userId = req.user!.userId;
    const db = getDb();

    // Check if contact exists
    const contactResult = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .limit(1);

    if (contactResult.length === 0) {
      console.log("❌ Contact not found");
      return res.status(404).json({ success: false, error: "Contact not found" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update provided fields
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (status !== undefined) updateData.status = status;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (optIn !== undefined) updateData.optIn = optIn;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (note !== undefined) updateData.note = note;

    // Update tagIds based on the tagIds field from request
    if (typeof tagIds !== 'undefined') {
      console.log("🔄 Processing tagIds field for tagIds update:", tagIds);
      
      if (Array.isArray(tagIds)) {
        // Validate tag IDs exist for this user
        if (tagIds.length > 0) {
          const existingTags = await db.select()
            .from(tags)
            .where(
              and(
                inArray(tags.id, tagIds),
                eq(tags.userId, userId)
              )
            );
          
          const validTagIds = existingTags.map(tag => tag.id);
          console.log("✅ Valid tag IDs:", validTagIds);
          updateData.tagIds = validTagIds;
        } else {
          console.log("🔄 Setting tagIds to empty array");
          updateData.tagIds = [];
        }
      } else {
        console.log("⚠️ tagIds is not an array, setting to empty array");
        updateData.tagIds = [];
      }
    } else {
      console.log("ℹ️ tagIds not provided in request, leaving tagIds unchanged");
    }

    // Debug: Show what will be updated
    console.log("📊 Update data to apply:", JSON.stringify(updateData, null, 2));

    // Update contact
    const [updatedContact] = await db
      .update(contacts)
      .set(updateData)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();

    console.log("✅ PUT /contacts/:id - COMPLETE");
    console.log("📤 Updated contact:", JSON.stringify(updatedContact, null, 2));

    // Get tag details for response
    let tagDetails = [];
    if (updatedContact.tagIds && updatedContact.tagIds.length > 0) {
      tagDetails = await getTagsWithDetails(updatedContact.tagIds, userId);
    }

    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
  } catch (error: any) {
    console.error("❌ Error updating contact:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to update contact",
      details: error.message,
    });
  }
});
// PATCH /api/contacts/:id/status - Update contact status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;
    const db = getDb();
    
    if (!status) {
      return res.status(400).json({ 
        success: false,
        error: 'Status is required' 
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
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // Get tag details for response
    let tagDetails = [];
    if (updatedContact.tagIds && updatedContact.tagIds.length > 0) {
      tagDetails = await getTagsWithDetails(updatedContact.tagIds, userId);
    }
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: any) {
    console.error('Error updating contact status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update contact status' 
    });
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
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
        error: 'Contact not found' 
      });
    }
    
    // Delete contact
    await db.delete(contacts)
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

// GET /api/contacts/analytics/overview - Get contact analytics
router.get('/analytics/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    console.log('contacts analytics overview called for user:', userId);
    const db = getDb();
    
    // Get total contacts
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;
    
    // Get contacts by status
    const byStatusResult = await db.select({
      status: contacts.status,
      count: sql<number>`count(*)`,
    })
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .groupBy(contacts.status);
    
    // Get contacts by tag
    const byTagResult = await db.execute(sql`
      SELECT tag_id, COUNT(*) as count
      FROM contacts, unnest(contacts.tag_ids) as tag_id
      WHERE contacts.user_id = ${userId}
      AND tag_id IS NOT NULL
      GROUP BY tag_id
      ORDER BY count DESC
    `);
    
    // Get tag names for the tag IDs
    const tagDetails = byTagResult.rows.length > 0 ? await db.select()
      .from(tags)
      .where(
        and(
          inArray(tags.id, byTagResult.rows.map((row: any) => row.tag_id)),
          eq(tags.userId, userId)
        )
      ) : [];
    
    const byTag = byTagResult.rows.map((row: any) => {
      const tag = tagDetails.find(t => t.id === row.tag_id);
      return {
        tag: tag?.name || row.tag_id,
        tagId: row.tag_id,
        count: Number(row.count),
        color: tag?.color || '#3B82F6',
      };
    });
    
    // Get new contacts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonthResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          sql`${contacts.createdAt} >= ${startOfMonth}`
        )
      );
    
    const newThisMonth = newThisMonthResult.length > 0 ? Number(newThisMonthResult[0].count) : 0;
    
    res.json({
      success: true,
      analytics: {
        total,
        byStatus: byStatusResult.map(row => ({
          status: row.status,
          count: Number(row.count),
        })),
        byTag,
        newThisMonth,
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching contact analytics:', error?.message || error, error?.stack || '');
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch contact analytics' 
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
    
    // Get tag details for response
    const tagDetails = await getTagsWithDetails(newTagIds, userId);
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
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
    
    // Get tag details for response
    const tagDetails = await getTagsWithDetails(newTagIds, userId);
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: any) {
    console.error('Error removing tags from contact:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove tags' 
    });
  }
});

// PATCH /api/contacts/:id/last-contacted - Update last contacted timestamp
router.patch('/:id/last-contacted', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
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
        error: 'Contact not found' 
      });
    }
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // Get tag details for response
    let tagDetails = [];
    if (updatedContact.tagIds && updatedContact.tagIds.length > 0) {
      tagDetails = await getTagsWithDetails(updatedContact.tagIds, userId);
    }
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: any) {
    console.error('Error updating last contacted:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update last contacted' 
    });
  }
});

router.get('/test-log', (req, res) => {
  console.log('✅ TEST LOG: This should appear in terminal');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  res.json({ success: true, message: 'Check your terminal for logs' });
});

export default router;