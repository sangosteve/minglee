import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { conversations, contacts, messages, users, quickReplies, mediaAttachments } from '../db/schema';
import { eq, and, or, like, desc, isNull, sql, inArray } from 'drizzle-orm';
import { VariableService } from '../services/variable.service';
import axios from 'axios';

const router = Router();

// ---------------------- HELPER ---------------------- //
async function sendMessageToContact(
  db: any,
  conversation: any,
  contact: any,
  user: any,
  body?: string,
  mediaAttachmentsList: any[] = []
) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const baseUrl = `https://graph.facebook.com/${apiVersion}`;
  let whatsappResponse: any[] = [];
  let whatsappMessageIds: string[] = [];
  let savedMessages: any[] = [];

  // WhatsApp Business API can't send text message and media in the same API call
  // We need to handle text and media separately
  
  // Case 1: Text only (no media)
  if (body?.trim() && mediaAttachmentsList.length === 0) {
    const response = await axios.post(
      `${baseUrl}/${user.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: contact.phone,
        type: 'text',
        text: { body: body.trim() },
      },
      {
        headers: {
          Authorization: `Bearer ${user.whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    whatsappResponse.push(response.data);
    const textMessageId = response.data?.messages?.[0]?.id;
    
    // Save text message
    const [newMessage] = await db.insert(messages).values({
      conversationId: conversation.id,
      contactId: contact.id,
      whatsappMessageId: textMessageId,
      direction: 'outgoing',
      messageType: 'text',
      body: body.trim(),
      status: textMessageId ? 'sent' : 'failed',
      metadata: {
        whatsappResponse: response.data,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    }).returning();
    
    savedMessages.push(newMessage);
    if (textMessageId) whatsappMessageIds.push(textMessageId);
  }
  
  // Case 2: Media with/without caption
  for (let i = 0; i < mediaAttachmentsList.length; i++) {
    const media = mediaAttachmentsList[i];
    const type = media.mimeType?.startsWith('image/') ? 'image' :
                 media.mimeType?.startsWith('video/') ? 'video' :
                 media.mimeType?.startsWith('audio/') ? 'audio' :
                 'document';
    
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact.phone,
      type,
      [type]: { 
        link: media.secureUrl || media.url,
        // Use body as caption for the first media, or media.caption if available
        caption: (i === 0 && body?.trim()) ? body.trim() : media.caption || undefined
      },
    };
    
    const response = await axios.post(
      `${baseUrl}/${user.whatsappPhoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${user.whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    whatsappResponse.push(response.data);
    const mediaMessageId = response.data?.messages?.[0]?.id;
    
    // Save media message
    const [newMediaMessage] = await db.insert(messages).values({
      conversationId: conversation.id,
      contactId: contact.id,
      whatsappMessageId: mediaMessageId,
      direction: 'outgoing',
      messageType: type,
      body: (i === 0 && body?.trim()) ? body.trim() : '', // Save caption as body for the first media
      status: mediaMessageId ? 'sent' : 'failed',
      metadata: {
        whatsappResponse: response.data,
        timestamp: new Date().toISOString(),
        mediaAttachmentId: media.id, // Save media ID for tracking
        secureUrl: media.secureUrl || media.url,
        originalFilename: media.originalFilename || media.filename,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        width: media.width,
        height: media.height,
        duration: media.duration,
        caption: (i === 0 && body?.trim()) ? body.trim() : media.caption,
      },
      timestamp: new Date(),
    }).returning();
    
    savedMessages.push(newMediaMessage);
    if (mediaMessageId) whatsappMessageIds.push(mediaMessageId);
  }

  // Update conversation last message
  const lastMessageText = body?.trim() || (mediaAttachmentsList.length > 0 ? `[${mediaAttachmentsList.length} media]` : '');
  await db.update(conversations)
    .set({
      lastMessage: lastMessageText,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id));

  return { 
    whatsappResponse, 
    whatsappMessageIds,
    savedMessages 
  };
}

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
    // For chat: we want page 1 to show the LATEST messages
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get messages in DESCENDING order (newest first) with pagination
    const messagesList = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.timestamp)) // DESCENDING order (newest first)
      .limit(Number(limit))
      .offset(offset);

    res.json({
      success: true,
      conversation: conversationResult[0].conversation,
      contact: conversationResult[0].contact,
      messages: messagesList, // Newest messages first
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

    const [conversationData] = await db.select({ conversation: conversations, contact: contacts, user: users })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.userId, users.id))
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversationData) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const { conversation, contact, user } = conversationData;

    if (!contact.phone) return res.status(400).json({ success: false, error: 'Contact does not have a phone number' });
    if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) return res.status(400).json({ success: false, error: 'WhatsApp not configured for this user' });

    // Format attachments properly
    const formattedAttachments = attachments.map((att: any) => ({
      id: att.id,
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

    const result = await sendMessageToContact(db, conversation, contact, user, message, formattedAttachments);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message', details: error.message });
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
    }

    // Personalize message
    const variables = VariableService.getAvailableVariables(conversation, contact, user);
    const personalizedMessage = VariableService.replaceVariables(quickReply.message, variables);

    const result = await sendMessageToContact(
      db, 
      conversation, 
      contact, 
      user, 
      personalizedMessage, 
      mediaAttachmentsList
    );

    res.json({
      success: true,
      ...result,
      preview: { original: quickReply.message, personalized: personalizedMessage },
    });
  } catch (error: any) {
    console.error('❌ Error sending quick reply:', error);
    res.status(500).json({ success: false, error: 'Failed to send quick reply', details: error.message });
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