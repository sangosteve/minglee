// backend/src/routes/conversations.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { conversations, contacts, messages, users, quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, isNull, sql, inArray } from 'drizzle-orm';
import { VariableService } from '../services/variable.service';
import { messageService } from '../services/message/message.service';

const router = Router();

// ---------------------- ROUTES ---------------------- //

// GET unread count
router.get('/unread/count', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();

    const result = await db.select({ count: sql`sum(${conversations.unreadCount})` })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    const count = result[0]?.count || 0;

    res.json({ success: true, count: Number(count) });
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// GET assigned conversations
router.get('/assigned/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    const db = getDb();

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

    const formattedConversations = assignedConversations.map(({ conversation, contact, assignedUser }) => ({
      ...conversation,
      contact: contact || null,
      assignedUser: assignedUser ? { name: assignedUser.name, email: assignedUser.email } : null,
    }));

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.assignedToUserId, userId)));

    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('❌ Error fetching assigned conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assigned conversations', details: error.message });
  }
});

// GET unassigned conversations
router.get('/unassigned', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    const db = getDb();

    const unassignedConversations = await db.select({ conversation: conversations, contact: contacts })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(eq(conversations.userId, userId), isNull(conversations.assignedToUserId)))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(Number(limit))
      .offset(offset);

    const formattedConversations = unassignedConversations.map(({ conversation, contact }) => ({
      ...conversation,
      contact: contact || null,
      assignedUser: null,
    }));

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), isNull(conversations.assignedToUserId)));

    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('❌ Error fetching unassigned conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unassigned conversations', details: error.message });
  }
});

// GET all conversations
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const userId = req.user!.userId;
    const db = getDb();

    const whereConditions: any[] = [eq(conversations.userId, userId)];

    if (status && status !== 'all') whereConditions.push(eq(conversations.status, String(status)));
    if (search) {
      whereConditions.push(or(
        like(contacts.name, `%${search}%`),
        like(contacts.phone, `%${search}%`),
        like(conversations.lastMessage, `%${search}%`)
      ));
    }

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

    const formattedConversations = allConversations.map(({ conversation, contact, assignedUser }) => ({
      ...conversation,
      contact: contact || null,
      assignedUser: assignedUser ? { name: assignedUser.name, email: assignedUser.email } : null,
    }));

    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(...whereConditions));

    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    res.json({
      success: true,
      conversations: formattedConversations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations', details: error.message });
  }
});

// GET conversation by ID with messages
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user!.userId;
    const db = getDb();

    const conversationResult = await db.select({ conversation: conversations, contact: contacts })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversationResult.length) return res.status(404).json({ success: false, error: 'Conversation not found' });

    // Get total count first
    const totalResult = await db.select({ count: sql`count(*)` }).from(messages).where(eq(messages.conversationId, id));
    const total = totalResult.length ? Number(totalResult[0].count) : 0;

    // Calculate offset for DESCENDING order (newest first)
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get messages in DESCENDING order (newest first) with pagination
    const messagesList = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.timestamp))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      success: true,
      conversation: conversationResult[0].conversation,
      contact: conversationResult[0].contact,
      messages: messagesList,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
  }
});

// POST send message (text or media)
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message, attachments = [] } = req.body;
    const userId = req.user!.userId;
    const db = getDb();

    console.log('📦 Received message payload:', {
      message,
      attachments: attachments.map((att: any) => ({
        id: att.id,
        hasUrl: !!(att.secureUrl || att.url),
        secureUrl: att.secureUrl,
        url: att.url,
        mimeType: att.mimeType,
        filename: att.originalFilename || att.filename,
      }))
    });

    if (!message?.trim() && attachments.length === 0) {
      return res.status(400).json({ success: false, error: 'Message or attachments required' });
    }

    // Get conversation, contact, and user
    const [conversationData] = await db.select({ conversation: conversations, contact: contacts, user: users })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversationData) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const { conversation, contact, user } = conversationData;

    if (!contact.phone) return res.status(400).json({ success: false, error: 'Contact does not have a phone number' });
    if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
      return res.status(400).json({ success: false, error: 'WhatsApp not configured for this user' });
    }

    // Personalize message with variables
    let personalizedMessage = message;
    if (message && message.includes('{{') && contact && user) {
      const variables = VariableService.getAvailableVariables(conversation, contact, user);
      personalizedMessage = VariableService.replaceVariables(message, variables);
      
      if (message !== personalizedMessage) {
        console.log('✅ Personalized message:', personalizedMessage);
      }
    }

    // Format attachments - FIXED: Ensure we extract IDs correctly
    const formattedAttachments = attachments.map((att: any) => ({
      id: att.id, // This should be the media attachment ID from mediaAttachments table
      url: att.secureUrl || att.url,
      secureUrl: att.secureUrl || att.url,
      mimeType: att.mimeType,
      originalFilename: att.originalFilename || att.filename,
      filename: att.filename || att.originalFilename,
      fileSize: att.fileSize,
      width: att.width,
      height: att.height,
      duration: att.duration,
      caption: att.caption,
    }));

    // Use unified MessageService to send message
    const result = await messageService.sendMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      userId: user.id,
      body: personalizedMessage,
      attachments: formattedAttachments,
      direction: 'outgoing',
      metadata: {
        originalMessage: message,
        personalized: personalizedMessage !== message,
      },
    });

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: {
        ...result,
        mediaAttachmentId: result.mediaAttachmentId, // This will be the ID from mediaAttachments table
      }
    });
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

// POST send quick reply
router.post('/:conversationId/quick-replies/:quickReplyId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId, quickReplyId } = req.params;
    const userId = req.user!.userId;
    const db = getDb();

    // Get conversation, contact, and user
    const [conversationData] = await db.select({ conversation: conversations, contact: contacts, user: users })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversationData) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const { conversation, contact, user } = conversationData;

    // Get quick reply with media attachments
    const quickReplyResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, userId),
        eq(quickReplies.isActive, true)
      ))
      .limit(1);

    if (!quickReplyResult.length) return res.status(404).json({ success: false, error: 'Quick reply not found' });

    const quickReply = quickReplyResult[0];

    // Get media attachments if any
    let mediaAttachmentsList: any[] = [];
    if (quickReply.mediaAttachmentIds && quickReply.mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, quickReply.mediaAttachmentIds));
      
      console.log('📦 Quick reply media attachments found:', {
        count: mediaAttachmentsList.length,
        attachments: mediaAttachmentsList.map(att => ({
          id: att.id,
          secureUrl: att.secureUrl,
          thumbnailUrl: att.thumbnailUrl,
          mimeType: att.mimeType,
          originalFilename: att.originalFilename,
        }))
      });
    }

    // Personalize message
    const variables = VariableService.getAvailableVariables(conversation, contact, user);
    const personalizedMessage = VariableService.replaceVariables(quickReply.message, variables);

    // Format attachments for MessageService
    const formattedAttachments = mediaAttachmentsList.map((media: any) => ({
      id: media.id,
      url: media.secureUrl || media.thumbnailUrl,
      secureUrl: media.secureUrl || media.thumbnailUrl,
      mimeType: media.mimeType,
      originalFilename: media.originalFilename,
      filename: media.originalFilename,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      duration: media.duration,
      caption: personalizedMessage, // Use the personalized message as caption
    }));

    console.log('📤 Sending quick reply:', {
      conversationId: conversation.id,
      contactId: contact.id,
      hasAttachments: formattedAttachments.length > 0,
      attachmentCount: formattedAttachments.length,
      message: personalizedMessage,
    });

    // Use unified MessageService to send message
    let result;
    if (formattedAttachments.length > 0) {
      // Send with media attachments
      result = await messageService.sendMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        userId: user.id,
        body: personalizedMessage,
        attachments: formattedAttachments,
        direction: 'outgoing',
        metadata: {
          quickReplyId: quickReply.id,
          quickReplyName: quickReply.name,
          originalMessage: quickReply.message,
          personalized: personalizedMessage !== quickReply.message,
           isQuickReply: quickReplyId ? true : false,
        },
      });
    } else {
      // Send as text-only message
      result = await messageService.sendMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        userId: user.id,
        body: personalizedMessage,
        attachments: [],
        direction: 'outgoing',
        metadata: {
          quickReplyId: quickReply.id,
          quickReplyName: quickReply.name,
          originalMessage: quickReply.message,
          personalized: personalizedMessage !== quickReply.message,
          isQuickReply: true,
        },
      });
    }

    res.json({
      success: true,
      message: formattedAttachments.length > 0 
        ? 'Quick reply with media sent successfully' 
        : 'Quick reply sent successfully',
      data: {
    ...result,
    mediaAttachmentId: result.mediaAttachmentId, // Include media attachment ID
  },
      preview: { 
        original: quickReply.message, 
        personalized: personalizedMessage,
        hasMedia: formattedAttachments.length > 0,
        mediaCount: formattedAttachments.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Error sending quick reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send quick reply', 
      details: error.message,
    });
  }
});
// ---------------------- PATCH ROUTES ---------------------- //

// Mark conversation as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.update(conversations)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(conversations.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error marking conversation as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read', details: error.message });
  }
});

// Update conversation status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDb();

    await db.update(conversations)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversations.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error updating conversation status:', error);
    res.status(500).json({ success: false, error: 'Failed to update status', details: error.message });
  }
});

// Assign conversation to a user
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId: assignedToUserId } = req.body;
    const db = getDb();

    await db.update(conversations)
      .set({ assignedToUserId, updatedAt: new Date() })
      .where(eq(conversations.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error assigning conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to assign conversation', details: error.message });
  }
});

export default router;