import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { conversations, contacts, messages, users } from '../db/schema';
import { eq, and, or, like, desc, asc, sql,isNull } from 'drizzle-orm';

const router = Router();
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
// GET /api/conversations/assigned - Get conversations assigned to current user
router.get('/assigned/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    console.log("me id:", userId)


    // FIXED: Use isNull for comparison instead of raw SQL string
    const assignedConversations = await db.select({
      conversation: conversations,
      contact: contacts,
      assignedUser: users,
    })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.assignedToUserId, users.id))
      .where(eq(conversations.assignedToUserId, userId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(Number(limit))
      .offset(offset);

 

    // Format the response
    const formattedConversations = assignedConversations.map(({ conversation, contact, assignedUser }) => {
      return {
        ...conversation,
        contact: contact || null,
        assignedUser: assignedUser ? {
          name: assignedUser.name,
          email: assignedUser.email
        } : null
      };
    });

    // Count total
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.assignedToUserId, userId)
        )
      );

    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching assigned conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned conversations',
      details: error.message
    });
  }
});
// GET /api/conversations/unassigned - Get unassigned conversations
router.get('/unassigned', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;

    // FIXED: Use isNull for unassigned conversations
    const unassignedConversations = await db.select({
      conversation: conversations,
      contact: contacts,
    })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(
        and(
          eq(conversations.userId, userId),
          isNull(conversations.assignedToUserId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(Number(limit))
      .offset(offset);

    // Format the response
    const formattedConversations = unassignedConversations.map(({ conversation, contact }) => {
      return {
        ...conversation,
        contact: contact || null,
        assignedUser: null
      };
    });

    // Count total
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          isNull(conversations.assignedToUserId)
        )
      );

    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching unassigned conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unassigned conversations',
      details: error.message
    });
  }
});
// GET /api/conversations - Get all conversations for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;

    // Build WHERE clause
    const whereConditions = [eq(conversations.userId, userId)];

    if (status && status !== 'all') {
      whereConditions.push(eq(conversations.status, String(status)));
    }

    // Add search filter if provided
    if (search) {
      const searchCondition = or(
        like(contacts.name, `%${search}%`),
        like(contacts.phone, `%${search}%`),
        like(conversations.lastMessage, `%${search}%`)
      );
      whereConditions.push(searchCondition);
    }

    // Get conversations with contacts and assigned users
    const allConversations = await db.select({
      conversation: conversations,
      contact: contacts,
      assignedUser: users,
    })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.assignedToUserId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(Number(limit))
      .offset(offset);

    // Format the response
    const formattedConversations = allConversations.map(({ conversation, contact, assignedUser }) => {
      return {
        ...conversation,
        contact: contact || null,
        assignedUser: assignedUser ? {
          name: assignedUser.name,
          email: assignedUser.email
        } : null
      };
    });

    // Count total
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(...whereConditions));

    const total = totalResult.length > 0 ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching conversations:', error);
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




// PATCH /api/conversations/:id/assign - Assign conversation to user
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { assignedToUserId } = req.body;
    const userId = req.user!.userId;

    const db = getDb();

    // First, verify the conversation exists and user has access
    const conversationResult = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId) // User must own the conversation to assign it
        )
      )
      .limit(1);

    if (conversationResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found or you do not have permission',
      });
    }

    // If assigning to a specific user, verify that user exists
    if (assignedToUserId) {
      const userResult = await db.select()
        .from(users)
        .where(eq(users.id, assignedToUserId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User to assign to not found',
        });
      }
    }

    // Update the assignment
    const [updatedConversation] = await db.update(conversations)
      .set({
        assignedToUserId: assignedToUserId || null, // null to unassign
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    // Get assigned user details if assigned
    let assignedUser = null;
    if (assignedToUserId) {
      const userResult = await db.select({
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, assignedToUserId))
        .limit(1);

      assignedUser = userResult[0] || null;
    }

    res.json({
      success: true,
      conversation: updatedConversation,
      assignedUser
    });

  } catch (error: any) {
    console.error('❌ Error assigning conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign conversation',
      details: error.message
    });
  }
});



export default router;