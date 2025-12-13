// backend/src/routes/contacts.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { contacts } from '../db/schema';
import { eq, and, or, like, inArray, desc, asc, sql } from 'drizzle-orm';

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
      const tagArray = Array.isArray(tags) ? tags : [tags];
      conditions.push(inArray(contacts.tags, tagArray));
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
    
    res.json({
      success: true,
      contacts: contactsList,
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
    
    res.json({
      success: true,
      contact: contactResult[0],
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
      tags = [],
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
    
    // Create contact
    const [newContact] = await db.insert(contacts).values({
      name,
      phone,
      email: email || '',
      city: city || '',
      state: state || '',
      country: country || '',
      status,
      tags: Array.isArray(tags) ? tags : [],
      metadata,
      note: note || '',
      userId,
      source,
      isActive: true,
      optIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
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
    const {
      name,
      phone,
      email,
      city,
      state,
      country,
      status,
      tags,
      metadata,
      note,
      isActive,
      optIn
    } = req.body;
    
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
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Only update fields that are provided
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (metadata !== undefined) updateData.metadata = metadata;
    if (note !== undefined) updateData.note = note;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (optIn !== undefined) updateData.optIn = optIn;
    
    // If phone is being updated, check for duplicates
    if (phone && phone !== contactResult[0].phone) {
      const duplicateContact = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.phone, phone),
            eq(contacts.userId, userId),
            eq(contacts.id, id) // Exclude current contact
          )
        )
        .limit(1);
      
      if (duplicateContact.length > 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Another contact with this phone number already exists' 
        });
      }
    }
    
    const [updatedContact] = await db.update(contacts)
      .set(updateData)
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
    
    res.json({
      success: true,
      contact: updatedContact,
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

// GET /api/contacts/analytics - Get contact analytics
router.get('/analytics/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
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
      SELECT tag, COUNT(*) as count
      FROM contacts, unnest(contacts.tags) as tag
      WHERE contacts."userId" = ${userId}
      GROUP BY tag
      ORDER BY count DESC
    `);
    
    // Get new contacts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonthResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          sql`contacts."createdAt" >= ${startOfMonth}`
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
        byTag: Array.isArray(byTagResult.rows) ? byTagResult.rows.map((row: any) => ({
          tag: row.tag,
          count: Number(row.count),
        })) : [],
        newThisMonth,
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching contact analytics:', error);
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
    const { tags } = req.body;
    const userId = req.user!.userId;
    const db = getDb();
    
    if (!tags || !Array.isArray(tags)) {
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
    
    const currentTags = contactResult[0].tags || [];
    const newTags = [...new Set([...currentTags, ...tags])];
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tags: newTags,
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
    const { tags } = req.body;
    const userId = req.user!.userId;
    const db = getDb();
    
    if (!tags || !Array.isArray(tags)) {
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
    
    const currentTags = contactResult[0].tags || [];
    const newTags = currentTags.filter(tag => !tags.includes(tag));
    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        tags: newTags,
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

export default router;