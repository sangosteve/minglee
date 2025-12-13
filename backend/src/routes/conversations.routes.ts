import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { conversations, contacts, messages, users } from '../db/schema';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';

const router = Router();

// GET /api/conversations - Get all conversations for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status 
    } = req.query;
    
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    
    
    
    // Build WHERE clause
    let whereClause = `c.user_id = '${userId}'`;
    
    if (status && status !== 'all') {
      whereClause += ` AND c.status = '${status}'`;
   
    }
    
 
    try {
      const columnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        ORDER BY ordinal_position
      `;
      const columnsResult = await db.execute(sql.raw(columnsQuery));
     
    
    } catch (error) {
      console.log('⚠️ Could not check columns:', error.message);
    }
    
    // Build SELECT columns dynamically based on what exists
    // For now, let's use a simple approach
    const conversationsQuery = `
      SELECT 
        c.id,
        c.contact_id as "contactId",
        c.user_id as "userId",
        c.whatsapp_phone_number_id as "whatsappPhoneNumberId",
        c.last_message as "lastMessage",
        c.last_message_at as "lastMessageAt",
        c.unread_count as "unreadCount",
        c.status,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        con.id as "contact_id",
        con.name as "contact_name",
        con.phone as "contact_phone",
        con.email as "contact_email",
        con.status as "contact_status",
        con.tags as "contact_tags"
      FROM conversations c
      LEFT JOIN contacts con ON c.contact_id = con.id
      WHERE ${whereClause}
      ORDER BY c.last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
 
    const conversationsResult = await db.execute(sql.raw(conversationsQuery));
 
    
    // Format the response
    const formattedConversations = conversationsResult.rows.map((row: any) => {
      const conversation = {
        id: row.id,
        contactId: row.contactId,
        userId: row.userId,
        whatsappPhoneNumberId: row.whatsappPhoneNumberId,
        lastMessage: row.lastMessage,
        lastMessageAt: row.lastMessageAt,
        unreadCount: row.unreadCount,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      
      const contact = row.contact_id ? {
        id: row.contact_id,
        name: row.contact_name,
        phone: row.contact_phone,
        email: row.contact_email,
        // Note: avatarUrl is removed since we don't have it
        status: row.contact_status,
        tags: row.contact_tags || [],
      } : null;
      
    
      return {
        ...conversation,
        contact,
      };
    });
    
    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM conversations c
      WHERE ${whereClause}
    `;
    
    const countResult = await db.execute(sql.raw(countQuery));
    const total = countResult.rows[0]?.total || 0;
    
  
    

    
    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        pages: Math.ceil(Number(total) / Number(limit)),
      },
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching conversations:', error);
    
    // More detailed error logging
    if (error.query) {
      console.error('📝 Failed query:', error.query.substring(0, 300) + '...');
    }
    if (error.cause) {
      console.error('🔍 Error cause:', error.cause.message);
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch conversations',
      details: error.message 
    });
  }
});
// GET /api/conversations/:id - Get conversation with messages
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user!.userId;
    const offset = (Number(page) - 1) * Number(limit);
    
    const db = getDb();
    
    // Get conversation with contact details
    const conversationResult = await db.select({
      conversation: conversations,
      contact: contacts,
    })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .limit(1);
    
    if (conversationResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    // Get messages
    const messagesList = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.timestamp))
      .limit(Number(limit))
      .offset(offset);
    
    // Get total message count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, id));
    
    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;
    
    res.json({
      success: true,
      conversation: conversationResult[0].conversation,
      contact: conversationResult[0].contact,
      messages: messagesList.reverse(), // Reverse to show oldest first
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch conversation' 
    });
  }
});

// POST /api/conversations/:id/messages - Send message
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user!.userId;
    
    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }
    
    const db = getDb();
    
    // Get conversation with contact details
    const conversationResult = await db.select({
      conversation: conversations,
      contact: contacts,
      user: users,
    })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .limit(1);
    
    if (conversationResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    const { conversation, contact, user } = conversationResult[0];
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found for this conversation',
      });
    }
    
    if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured for this user',
      });
    }
    
    // Check if contact has a phone number
    if (!contact.phone) {
      return res.status(400).json({
        success: false,
        error: 'Contact does not have a phone number',
      });
    }
    
    console.log('📤 Sending WhatsApp message:', {
      to: contact.phone,
      message: message.trim(),
      whatsappPhoneNumberId: user.whatsappPhoneNumberId,
    });
    
    let whatsappResponse;
    let whatsappMessageId;
    
    try {
      // Send actual WhatsApp message
      const axios = require('axios');
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
      const baseUrl = `https://graph.facebook.com/${apiVersion}`;
      
      const response = await axios.post(
        `${baseUrl}/${user.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: contact.phone,
          type: 'text',
          text: {
            body: message.trim(),
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${user.whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      whatsappResponse = response.data;
      whatsappMessageId = response.data?.messages?.[0]?.id;
      
    
      
    } catch (whatsappError: any) {
      console.error('❌ WhatsApp API error:', {
        status: whatsappError.response?.status,
        data: whatsappError.response?.data,
        message: whatsappError.message,
      });
      
      // Check for specific WhatsApp API errors
      const errorData = whatsappError.response?.data?.error;
      
      if (errorData?.code === 131047) {
        return res.status(400).json({
          success: false,
          error: 'Cannot send message to this number. The user may have opted out.',
          details: errorData.message,
        });
      }
      
      if (errorData?.code === 132000) {
        return res.status(400).json({
          success: false,
          error: 'Message template required for this recipient',
          details: errorData.message,
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to send WhatsApp message',
        details: errorData?.message || whatsappError.message,
      });
    }
    
    // Save the message to database
    const [newMessage] = await db.insert(messages).values({
      conversationId: id,
      contactId: conversation.contactId,
      whatsappMessageId: whatsappMessageId,
      direction: 'outgoing',
      messageType: 'text',
      body: message.trim(),
      status: whatsappMessageId ? 'sent' : 'failed',
      metadata: {
        whatsappResponse: whatsappResponse,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    }).returning();
    
    // Update conversation
    await db.update(conversations)
      .set({
        lastMessage: message.trim(),
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
    

    
    res.json({
      success: true,
      message: newMessage,
      whatsappMessageId: whatsappMessageId,
      whatsappResponse: whatsappResponse,
    });
    
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    console.error('🔍 Error details:', error.stack);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

// PATCH /api/conversations/:id/status - Update conversation status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }
    
    const db = getDb();
    
    const [updatedConversation] = await db.update(conversations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .returning();
    
    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    res.json({
      success: true,
      conversation: updatedConversation,
    });
    
  } catch (error: any) {
    console.error('Error updating conversation status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update conversation status' 
    });
  }
});

// PATCH /api/conversations/:id/read - Mark as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const db = getDb();
    
    const [updatedConversation] = await db.update(conversations)
      .set({
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId)
        )
      )
      .returning();
    
    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    res.json({
      success: true,
      conversation: updatedConversation,
    });
    
  } catch (error: any) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark conversation as read' 
    });
  }
});

// GET /api/conversations/unread/count - Get unread count
router.get('/unread/count', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    
    const result = await db.select({ 
      count: sql`sum(${conversations.unreadCount})` 
    })
      .from(conversations)
      .where(eq(conversations.userId, userId));
    
    const count = result[0]?.count || 0;
    
    res.json({
      success: true,
      count: Number(count),
    });
    
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get unread count' 
    });
  }
});

export default router;