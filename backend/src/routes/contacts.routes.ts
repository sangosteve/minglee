// backend/src/routes/contacts.routes.ts
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { contacts, tags, ContactInsert, ContactUpdate } from '../db/schema';
import { eq, and, or, like, inArray, desc, asc, sql, SQL } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';

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
      page = '1', 
      limit = '20', 
      search, 
      status, 
      tags: tagIds, 
      city,
      country,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const db = getDb();
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const userId = req.user!.userId;
    
    // Build where conditions
    const conditions: (SQL | undefined)[] = [eq(contacts.userId, userId)];
    
    if (search && typeof search === 'string') {
      const searchCondition = or(
        like(contacts.name, `%${search}%`),
        like(contacts.phone, `%${search}%`),
        like(contacts.email, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
   if (status && typeof status === 'string') {
  conditions.push(eq(contacts.status, status as 'active' | 'inactive' | 'archived' | 'blocked' | 'lead' | 'customer'));
}
    
    // Handle tag filtering by tag IDs
    if (tagIds) {
      const tagArray = Array.isArray(tagIds) ? tagIds : [tagIds];
      const tagCondition = sql`${contacts.tagIds} && ARRAY[${sql.join(tagArray.map(tag => sql`${tag}::uuid`), sql`, `)}]`;
      conditions.push(tagCondition);
    }
    
    if (city && typeof city === 'string') {
      conditions.push(eq(contacts.city, city));
    }
    
    if (country && typeof country === 'string') {
      conditions.push(eq(contacts.country, country));
    }
    
    // Filter out undefined conditions
    const validConditions = conditions.filter((c): c is SQL => c !== undefined);
    
    // Build query
    const whereClause = validConditions.length > 0 ? and(...validConditions) : undefined;
    const query = db.select().from(contacts);
    const queryWithWhere = whereClause ? query.where(whereClause) : query;
    
    // Apply sorting
    const sortFieldMap: Record<string, any> = {
      'name': contacts.name,
      'phone': contacts.phone,
      'email': contacts.email,
      'city': contacts.city,
      'country': contacts.country,
      'status': contacts.status,
      'lastContactedAt': contacts.lastContactedAt,
      'createdAt': contacts.createdAt,
      'updatedAt': contacts.updatedAt,
    };
    
    const sortField = sortFieldMap[sortBy as string] || contacts.createdAt;
    const sortedQuery = queryWithWhere.orderBy(
      sortOrder === 'desc' ? desc(sortField) : asc(sortField)
    );
    
    // Get paginated results
    const contactsList = await sortedQuery
      .limit(limitNum)
      .offset(offset);
    
    // Get total count
    const totalQuery = db.select({ count: sql<number>`count(*)` }).from(contacts);
    const totalQueryWithWhere = whereClause ? totalQuery.where(whereClause) : totalQuery;
    const totalResult = await totalQueryWithWhere;
    
    // FIX: Check if totalResult has elements before accessing
    const total = totalResult.length > 0 ? Number(totalResult[0]?.count) : 0;
    
    // Enhance contacts with tag details
    const enhancedContacts = await Promise.all(
      contactsList.map(async (contact) => {
        // FIX: Add explicit type annotation
        let tagDetails: InferSelectModel<typeof tags>[] = [];
        if (contact.tagIds && contact.tagIds.length > 0) {
          tagDetails = await getTagsWithDetails(contact.tagIds, userId);
        }
        return {
          ...contact,
          tags: tagDetails,
        };
      })
    );
    
    res.json({
      success: true,
      contacts: enhancedContacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching contacts:', err);
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
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
    
    // FIX: Add type guard or non-null assertion
    const contact = contactResult[0];
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found' 
      });
    }
    
    // Get tag details
    let tagDetails: InferSelectModel<typeof tags>[] = [];
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
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching contact:', err);
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
      tags: tagIds = [],
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
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
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
    
    // FIX: Create properly typed contact data
    const contactData: ContactInsert = {
      id: uuidv4(),
      name,
      phone,
      email: email || '',
      city: city || '',
      state: state || '',
      country: country || '',
      status,
      tagIds: validTagIds,
     customFields: metadata as Record<string, any>,
      note: note || '',
      userId,
      source,
      isActive: true,
      optIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastContactedAt: null,
      address: '',
      postalCode: '',
    };
    
    // Create contact
    const [newContact] = await db.insert(contacts).values(contactData).returning();
    
    // Get tag details for response
    let tagDetails: InferSelectModel<typeof tags>[] = [];
    if (validTagIds.length > 0) {
      tagDetails = await getTagsWithDetails(validTagIds, userId);
    }
    
    res.status(201).json({
      success: true,
      contact: {
        ...newContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error creating contact:', err);
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
    const {
      name,
      phone,
      email,
      city,
      state,
      country,
      status,
      tags: tagIds,
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

    // FIX: Use ContactUpdate type for better type safety
    const updateData: ContactUpdate = {
      updatedAt: new Date().toISOString(),
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
    if (metadata !== undefined) updateData.customFields = metadata as Record<string, any>;
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

    // FIX: Check if updatedContact exists
    if (!updatedContact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update contact',
      });
    }

    // Get tag details for response
    let tagDetails: InferSelectModel<typeof tags>[] = [];
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
  } catch (error: unknown) {
    const err = error as Error & { stack?: string };
    console.error("❌ Error updating contact:", err);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({
      success: false,
      error: "Failed to update contact",
      details: err.message,
    });
  }
});

// PATCH /api/contacts/:id/status - Update contact status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
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
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // FIX: Check if updatedContact exists
    if (!updatedContact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update contact status',
      });
    }
    
    // Get tag details for response
    let tagDetails: InferSelectModel<typeof tags>[] = [];
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
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error updating contact status:', err);
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
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
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error deleting contact:', err);
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
    
    // FIX: Check if totalResult[0] exists before accessing count
    const total = totalResult.length > 0 ? Number(totalResult[0]?.count) : 0;
    
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
    
    // FIX: Type assertion for byTagResult.rows
    const tagRows = byTagResult.rows as { tag_id: string; count: string }[];
    
    // Get tag names for the tag IDs
    const tagDetails = tagRows.length > 0 ? await db.select()
      .from(tags)
      .where(
        and(
          inArray(tags.id, tagRows.map(row => row.tag_id)),
          eq(tags.userId, userId)
        )
      ) : [];
    
    const byTag = tagRows.map((row) => {
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
          sql`${contacts.createdAt} >= ${startOfMonth.toISOString()}`
        )
      );
    
    const newThisMonth = newThisMonthResult.length > 0 ? Number(newThisMonthResult[0]?.count) : 0;
    
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
    
  } catch (error: unknown) {
    const err = error as Error & { message?: string; stack?: string };
    console.error('Error fetching contact analytics:', err?.message || err, err?.stack || '');
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
    const { tags: tagIds } = req.body;
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
    
    // FIX: Check if contactResult[0] exists
    const contact = contactResult[0];
    if (!contact) {
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
    const currentTagIds = contact.tagIds || [];  // FIX: Use contact instead of contactResult[0]
    const newTagIds = [...new Set([...currentTagIds, ...validTagIds])];
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tagIds: newTagIds,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // FIX: Check if updatedContact exists
    if (!updatedContact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to add tags to contact',
      });
    }
    
    // Get tag details for response
    const tagDetails = await getTagsWithDetails(newTagIds, userId);
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error adding tags to contact:', err);
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
    const { tags: tagIds } = req.body;
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
    
    // FIX: Check if contactResult[0] exists
    const contact = contactResult[0];
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found' 
      });
    }
    
    const currentTagIds = contact.tagIds || [];  // FIX: Use contact instead of contactResult[0]
    const newTagIds = currentTagIds.filter(tagId => !tagIds.includes(tagId));
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tagIds: newTagIds,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // FIX: Check if updatedContact exists
    if (!updatedContact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to remove tags from contact',
      });
    }
    
    // Get tag details for response
    const tagDetails = await getTagsWithDetails(newTagIds, userId);
    
    res.json({
      success: true,
      contact: {
        ...updatedContact,
        tags: tagDetails,
      },
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error removing tags from contact:', err);
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
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Contact ID is required' 
      });
    }
    
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
        lastContactedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.userId, userId)
        )
      )
      .returning();
    
    // FIX: Check if updatedContact exists
    if (!updatedContact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update last contacted',
      });
    }
    
    // Get tag details for response
    let tagDetails: InferSelectModel<typeof tags>[] = [];
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
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error updating last contacted:', err);
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