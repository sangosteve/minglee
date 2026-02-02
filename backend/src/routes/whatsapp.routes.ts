// backend/src/routes/whatsapp.routes.ts
import { Router } from 'express';
import { WhatsAppService, WhatsAppWebhookEvent } from '../services/whatsapp.service';
import { CloudinaryService, MediaFile } from '../services/cloudinary.service';
import { WhatsAppMediaService } from '../services/whatsapp-media.service';
import { automationExecutionService } from '../services/automation-execution.service';
import { ContactsService } from '../services/contacts.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { users, contacts, conversations, messages, mediaAttachments, automations } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
// Fix 1: Change Busboy import to handle CommonJS module properly
import * as Busboy from 'busboy';
import { messageService } from '../services/message/message.service';
import { triggerMatchingService } from '../services/trigger-matching.service';

const router = Router();

// ==================== WEBHOOK ENDPOINTS ====================

/**
 * Webhook verification (GET)
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification request:', { mode, token, challenge });

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Webhook verification failed');
      res.sendStatus(403);
    }
  } catch (error: any) {
    console.error('❌ Webhook verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
});

/**
 * Webhook receiver (POST)
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Webhook received');

    // WhatsApp requires a fast 200 response
    res.status(200).send('EVENT_RECEIVED');

    const event = req.body;

    if (!event || Object.keys(event).length === 0) {
      console.log('📭 Empty webhook payload');
      return;
    }

    console.log('📩 Webhook payload:', JSON.stringify(event, null, 2));

    const signature = req.headers['x-hub-signature-256'] as string;

    if (process.env.WHATSAPP_APP_SECRET) {
      const valid = WhatsAppService.validateWebhookSignature(
        JSON.stringify(event),
        signature
      );

      if (!valid) {
        console.error('❌ Invalid webhook signature');
        return;
      }
    }

    await processWebhookEvent(event);

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Process webhook events asynchronously
 */
async function processWebhookEvent(event: WhatsAppWebhookEvent) {
  try {
    if (!event || !event.entry) {
      console.log('⚠️ Empty webhook event, skipping');
      return;
    }

    console.log('🔄 Processing webhook event...');

    for (const entry of event.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        const value = change.value;

        // Check if this is a WhatsApp message event
        if (value?.messaging_product !== 'whatsapp') continue;

        // Extract metadata
        const metadata = value.metadata;
        if (!metadata?.display_phone_number || !metadata?.phone_number_id) {
          console.error('❌ Missing critical metadata in webhook:', metadata);
          continue;
        }

        // 1. Process incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          console.log(`📨 Found ${value.messages.length} incoming message(s)`);
          for (const message of value.messages) {
            await processIncomingMessage(message, {
              display_phone_number: metadata.display_phone_number,
              phone_number_id: metadata.phone_number_id
            });
          }
        }

        // 2. Process delivery status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          console.log(`📊 Found ${value.statuses.length} status update(s)`);
          for (const status of value.statuses) {
            await processMessageStatus(status);
          }
        }
      }
    }

    console.log('✅ Webhook event processing completed');
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
  }
}

/**
 * Get last message text for conversation
 */
function getLastMessageText(message: any): string {
  const messageType = message.type;

  console.log(`🔍 Getting last message text for type: ${messageType}`);

  // Text message
  if (message.text?.body) {
    const text = message.text.body.trim();
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  }

  // Interactive messages
  if (message.interactive) {
    const interactiveType = message.interactive.type;

    if (interactiveType === 'list_reply' && message.interactive.list_reply?.title) {
      return `Selected: ${message.interactive.list_reply.title}`;
    }

    if (interactiveType === 'button_reply' && message.interactive.button_reply?.title) {
      return `Clicked: ${message.interactive.button_reply.title}`;
    }

    if (interactiveType === 'nfm_reply' && message.interactive.nfm_reply) {
      return 'Flow message received';
    }

    return 'Interactive message';
  }

  // Button message
  if (message.button) {
    return `Button: ${message.button.text || 'Button message'}`;
  }

  // Location message
  if (messageType === 'location' && message.location) {
    return `📍 Location: ${message.location.name || message.location.address || 'Shared location'}`;
  }

  // Contacts message
  if (messageType === 'contacts' && message.contacts) {
    const count = Array.isArray(message.contacts) ? message.contacts.length : 1;
    return `👥 ${count} contact${count !== 1 ? 's' : ''} shared`;
  }

  // Media messages with caption
  if (message[messageType]?.caption) {
    const caption = message[messageType].caption.trim();
    return `${messageType}: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`;
  }

  // Media messages with filename
  if (message[messageType]?.filename) {
    return `${messageType}: ${message[messageType].filename}`;
  }

  // Document with filename
  if (messageType === 'document' && message.document) {
    return `📄 ${message.document.filename || 'Document'}`;
  }

  // Sticker
  if (messageType === 'sticker') {
    return '🩹 Sticker';
  }

  // Audio
  if (messageType === 'audio') {
    return '🎵 Audio message';
  }

  // Video
  if (messageType === 'video') {
    return '🎬 Video message';
  }

  // Image
  if (messageType === 'image') {
    return '📷 Image';
  }

  // Default fallbacks for all types
  const typeLabels: Record<string, string> = {
    'image': '📷 Image',
    'video': '🎬 Video',
    'audio': '🎵 Audio',
    'document': '📄 Document',
    'sticker': '🩹 Sticker',
    'contacts': '👥 Contacts',
    'interactive': '🔄 Interactive',
    'button': '🔘 Button',
    'location': '📍 Location',
    'reaction': '👍 Reaction',
    'order': '🛒 Order',
    'system': '⚙️ System',
    'unsupported': '❌ Unsupported',
    'unknown': '❓ Unknown',
  };

  return typeLabels[messageType] || `${messageType} message`;
}

/**
 * Check if this is the first message from a contact
 */
async function checkIsFirstMessage(
  userId: string,
  contactId: string,
  phoneNumberId: string
): Promise<boolean> {
  try {
    const db = getDb();

    // Fix 2: Type cast the SQL query
    const previousMessages = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.contact_id = ${contactId}
      AND c.user_id = ${userId}
      AND c.whatsapp_phone_number_id = ${phoneNumberId}
      AND m.direction = 'incoming'
    ` as any);

    const count = Number(previousMessages.rows[0]?.count || 0);
    return count === 0;

  } catch (error) {
    console.error('Error checking first message:', error);
    return false;
  }
}

/**
 * Process incoming message
 */
async function processIncomingMessage(
  message: any,
  metadata: { display_phone_number: string; phone_number_id: string }
) {
  try {
    console.log('📨 Processing incoming message:', JSON.stringify(message, null, 2));

    const whatsappPhoneNumberId = metadata.phone_number_id;
    const businessPhoneNumber = metadata.display_phone_number;

    console.log(`🏢 Business: ${businessPhoneNumber} (ID: ${whatsappPhoneNumberId})`);
    console.log(`📞 Sender: ${message.from}`);
    console.log(`💬 Message type: ${message.type}`);

    if (message.text?.body) {
      console.log(`📝 Text message: ${message.text.body.substring(0, 100)}...`);
    }

    const db = getDb();

    // 1. Find user who owns this WhatsApp number
    let [user] = await db.select()
      .from(users)
      .where(eq(users.whatsappPhoneNumberId, whatsappPhoneNumberId))
      .limit(1);

    if (!user) {
      console.log(`👤 No user found for WhatsApp business ID: ${whatsappPhoneNumberId}`);

      // Fallback to environment variables
      const envWhatsAppPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const envWhatsAppAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;

      if (whatsappPhoneNumberId === envWhatsAppPhoneNumberId) {
        [user] = await db.select()
          .from(users)
          .where(
            and(
              eq(users.whatsappPhoneNumberId, envWhatsAppPhoneNumberId || ''),
              eq(users.whatsappAccessToken, envWhatsAppAccessToken || '')
            )
          )
          .limit(1);
      }

      if (!user) {
        // Get first admin user or any user
        const adminUsers = await db.select()
          .from(users)
          .where(eq(users.isAdmin, true))
          .orderBy(users.createdAt)
          .limit(1);

        if (adminUsers.length > 0) {
          user = adminUsers[0];
        } else {
          const anyUser = await db.select()
            .from(users)
            .orderBy(users.createdAt)
            .limit(1);

          if (anyUser.length === 0) {
            console.error('❌ No users exist in database!');
            return;
          }

          user = anyUser[0];
        }

        console.log(`👤 Using user: ${user?.email} (ID: ${user?.id})`);
      }
    } else {
      console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    }

    // Fix 3: Add null check for user
    if (!user) {
      console.error('❌ User not found, cannot process message');
      return;
    }

    // 2. Find or create contact
    const senderPhoneNumber = message.from;
    let formattedPhone = senderPhoneNumber.replace(/\D/g, '');

    const senderName = message.contacts?.[0]?.profile?.name || `Contact ${formattedPhone}`;

    let [contact] = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, formattedPhone),
          eq(contacts.userId, user.id)
        )
      )
      .limit(1);

    if (!contact) {
      console.log(`➕ Creating new contact: ${senderName} (${formattedPhone})`);

      // Fix 4: Use SQL expressions or string dates for timestamps
      const contactData: any = {
        phone: formattedPhone,
        name: senderName,
        email: '',
        note: `WhatsApp contact created on ${new Date().toISOString()}`,
        userId: user.id,
        whatsappBusinessId: user.whatsappBusinessId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        whatsappPhoneNumberId: whatsappPhoneNumberId,
        isActive: true,
        source: 'whatsapp' as any,
        status: 'active' as any,
        optIn: true,
        createdAt: sql`now()`, // Use SQL expression instead of Date
        updatedAt: sql`now()`, // Use SQL expression instead of Date
      };

      try {
        [contact] = await db.insert(contacts).values(contactData).returning();
        console.log(`✅ Contact created: ${contact?.name} (ID: ${contact?.id})`);
      } catch (insertError: any) {
        console.error('❌ Error creating contact:', insertError);

        const minimalContactData = {
          phone: formattedPhone,
          name: senderName,
          userId: user.id,
          source: 'whatsapp' as any,
          status: 'active' as any,
          createdAt: sql`now()`, // Use SQL expression
          updatedAt: sql`now()`, // Use SQL expression
        };

        [contact] = await db.insert(contacts).values(minimalContactData).returning();
       
      }
    } else {
      console.log(`✅ Found existing contact: ${contact.name} (ID: ${contact.id})`);
    }

    // Fix 5: Add null check for contact
    if (!contact) {
      console.error('❌ Contact not found or created, cannot process message');
      return;
    }

    // 3. Find or create conversation
    let [conversation] = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.contactId, contact.id),
          eq(conversations.whatsappPhoneNumberId, whatsappPhoneNumberId)
        )
      )
      .limit(1);

    if (!conversation) {
      console.log(`➕ Creating new conversation for contact ${contact.id}`);

      const lastMessage = getLastMessageText(message);

      const conversationData = {
        contactId: contact.id,
        userId: user.id,
        whatsappPhoneNumberId: whatsappPhoneNumberId,
        lastMessage: lastMessage,
        lastMessageAt: sql`now()`, // Use SQL expression
        unreadCount: 1,
        status: 'active',
        createdAt: sql`now()`, // Use SQL expression
        updatedAt: sql`now()`, // Use SQL expression
      };

      [conversation] = await db.insert(conversations).values(conversationData).returning();
   
    } else {
      const lastMessage = getLastMessageText(message);
      // Fix 6: Use string dates or SQL expressions for date fields
      await db.update(conversations)
        .set({
          lastMessage: lastMessage,
          lastMessageAt: new Date().toISOString(), // Use ISO string instead of Date object
          unreadCount: (conversation.unreadCount || 0) + 1,
          updatedAt: new Date().toISOString(), // Use ISO string instead of Date object
        })
        .where(eq(conversations.id, conversation.id));

      console.log(`✅ Updated conversation: ID ${conversation.id}`);
    }

    // Fix 7: Add null check for conversation
    if (!conversation) {
      console.error('❌ Conversation not found or created, cannot save message');
      return;
    }

    // 4. Check if this is the first message from this contact
    const isFirstMessage = await checkIsFirstMessage(
      user.id,
      contact.id,
      whatsappPhoneNumberId
    );
    console.log(`📨 Is first message from contact: ${isFirstMessage}`);

    // 5. Prepare message body and metadata
    let messageBody = '';
    let messageMetadata: any = {
      type: message.type,
      whatsappMessageId: message.id,
      sender: message.from,
      timestamp: message.timestamp,
      isFirstMessage,
      receivedAt: new Date().toISOString(),
    };

    switch (message.type) {
      case 'text':
        messageBody = message.text?.body || '';
        messageMetadata.text = message.text;
        console.log(`📝 Text message: "${messageBody.substring(0, 100)}${messageBody.length > 100 ? '...' : ''}"`);
        break;

      case 'location':
        messageBody = message.location?.name || message.location?.address || 'Location shared';
        messageMetadata.location = message.location;
        console.log(`📍 Location: ${messageBody}`);
        break;

      case 'interactive':
        const interactiveType = message.interactive?.type;

        if (interactiveType === 'list_reply') {
          const selectedId = message.interactive.list_reply?.id;
          messageBody = message.interactive.list_reply?.title || 'List selection';
          messageMetadata.interactive = {
            type: 'list_reply',
            data: message.interactive.list_reply,
          };

          console.log(`🔄 List reply selected: ${selectedId} - ${messageBody}`);

          // Extract the row ID (remove prefixes)
          const rowId = selectedId?.replace(/^row-/, '').replace(/^row_/, '');

          // Check if this is a response to an automation list message
          await handleAutomationListSelection(
            user.id,
            contact.id,
            message.id,
            rowId,
            selectedId,
            message.interactive.list_reply?.title,
            conversation.id
          );
        } else if (interactiveType === 'button_reply') {
          const buttonId = message.interactive.button_reply?.id;
          messageBody = message.interactive.button_reply?.title || 'Button clicked';
          messageMetadata.interactive = {
            type: 'button_reply',
            data: message.interactive.button_reply,
          };
          console.log(`🔘 Button reply: ${buttonId} - ${messageBody}`);

          // Extract clean button ID (remove prefixes like 'btn_', 'qr_', 'action-')
          const cleanButtonId = buttonId
            ?.replace(/^btn_/, '')
            .replace(/^qr_/, '')
            .replace(/^action-/, '');

          // Check if this is a response to an automation interactive message
          await handleAutomationInteractiveSelection(
            user.id,
            contact.id,
            message.id,
            cleanButtonId || buttonId,
            message.interactive.button_reply?.title,
            conversation.id,
            'button_reply'
          );
        } else if (interactiveType === 'nfm_reply') {
          messageBody = 'Flow response';
          messageMetadata.interactive = {
            type: 'nfm_reply',
            data: message.interactive.nfm_reply,
          };
          console.log(`🌊 Flow reply`);
        } else {
          messageBody = 'Interactive message';
          messageMetadata.interactive = message.interactive;
          console.log(`🔄 Interactive: ${interactiveType}`);
        }
        break;
      case 'button':
        messageBody = message.button?.text || 'Button message';
        messageMetadata.button = message.button;
        console.log(`🔘 Button: ${messageBody}`);
        break;

      case 'contacts':
        const contactCount = Array.isArray(message.contacts) ? message.contacts.length : 1;
        messageBody = `Shared ${contactCount} contact(s)`;
        messageMetadata.contacts = message.contacts;
        console.log(`👥 Contacts: ${contactCount} contact(s)`);
        break;

      case 'reaction':
        messageBody = message.reaction?.emoji || 'Reaction';
        messageMetadata.reaction = message.reaction;
        console.log(`👍 Reaction: ${messageBody}`);
        break;

      case 'order':
        messageBody = 'Order details';
        messageMetadata.order = message.order;
        console.log(`🛒 Order`);
        break;

      case 'system':
        messageBody = message.system?.body || 'System message';
        messageMetadata.system = message.system;
        console.log(`⚙️ System: ${messageBody}`);
        break;

      // Media types
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker':
        // For media messages, use caption or filename as body
        const mediaData = message[message.type];
        messageBody = mediaData?.caption || mediaData?.filename || `${message.type} message`;
        messageMetadata[message.type] = mediaData;

        // Add media-specific metadata
        if (mediaData) {
          messageMetadata.media = {
            id: mediaData.id,
            mime_type: mediaData.mime_type,
            sha256: mediaData.sha256,
            caption: mediaData.caption,
            filename: mediaData.filename,
          };
        }
        console.log(`📁 ${message.type}: ${messageBody}`);
        break;

      default:
        // For any unknown/unsupported types
        console.warn(`⚠️ Unhandled message type: ${message.type}`, JSON.stringify(message, null, 2));
        messageBody = `[${message.type.toUpperCase()}] message`;
        messageMetadata.raw = message;
        break;
    }

    // Ensure messageBody is never empty
    if (!messageBody.trim()) {
      messageBody = getLastMessageText(message);
      console.log(`🔄 Using fallback message body: ${messageBody}`);
    }

    // 6. Handle media messages
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    const isMediaMessage = mediaTypes.includes(message.type);

    if (isMediaMessage && message[message.type]?.id) {
      console.log(`📁 Processing ${message.type} media message`);

      // Save message first, then process media in background
      const savedMessage = await messageService.saveMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        whatsappMessageId: message.id,
        direction: 'incoming',
        messageType: message.type,
        body: messageBody,
        status: 'processing',
        metadata: {
          ...messageMetadata,
          [message.type]: message[message.type],
          processing: true,
          processed: false,
          whatsappMediaId: message[message.type].id,
        },
      });

      console.log(`✅ Message saved with ID: ${savedMessage.id}`);

      // Process media in background
      processMediaMessageInBackground(
        message,
        savedMessage.id,
        user.id,
        contact.id,
        whatsappPhoneNumberId
      ).catch(error => {
        console.error(`❌ Background media processing failed for message ${savedMessage.id}:`, error);
      });

    } else {
      // Non-media message - save directly using MessageService
      console.log(`💾 Saving ${message.type} message`);

      const result = await messageService.sendMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        userId: user.id,
        body: messageBody,
        direction: 'incoming',
        messageType: message.type,
        metadata: messageMetadata,
      });

      console.log(`✅ Message saved: ID ${result.message?.id || 'unknown'}`);

      // Check and trigger automations for text messages using new trigger system
      if (message.text?.body && contact && user) {
        console.log(`🤖 Checking automations for incoming message: "${message.text.body.substring(0, 50)}..."`);

        // FIX: Add null check for result.message
        const savedMessageId = result.message?.id;
        
        checkAndTriggerAutomations(
          contact.id,
          user.id,
          message.text.body,
          {
            ...messageMetadata,
            phone_number_id: metadata.phone_number_id,
            business_phone_number: metadata.display_phone_number,
            conversation_id: conversation.id,
            // Only include saved_message_id if result.message exists
            ...(savedMessageId && { saved_message_id: savedMessageId }),
          },
          isFirstMessage
        ).catch(error => {
          console.error('❌ Background automation trigger failed:', error);
        });
      }
    }


    // 7. Optional: Mark message as read
    try {
      if (user.whatsappAccessToken) {
        await WhatsAppService.markAsRead(
          whatsappPhoneNumberId,
          message.id,
          user.whatsappAccessToken
        );
        console.log(`📖 Message marked as read`);
      } else {
        console.log(`ℹ️ No WhatsApp access token, skipping mark as read`);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }

    console.log(`✅ Message processing complete for ${senderName}`);
    console.log('---');

  } catch (error: any) {
    console.error('❌ Error processing incoming message:', error);
    console.error('❌ Error stack:', error.stack);
  }
}

/**
 * Handle automation list selection
 */
async function handleAutomationListSelection(
  userId: string,
  contactId: string,
  whatsappMessageId: string,
  rowId: string | undefined,
  selectedId: string | undefined,
  selectedTitle: string | undefined,
  conversationId: string
) {
  try {
    const db = getDb();

    console.log(`🤖 Checking for automation list selection: row=${rowId}, selected=${selectedId}, title=${selectedTitle}`);

    // Find the original list message that this is replying to
    // Look for messages with listData in metadata
    const listMessages = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'outgoing'),
          eq(messages.contactId, contactId),
          // Fix 8: Type cast the SQL template literal
          sql`messages.metadata->>'isInteractiveList' = 'true'` as any
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(1);

    if (listMessages.length === 0) {
      console.log(`🤖 No interactive list message found in conversation`);
      return;
    }

    const listMessage = listMessages[0];
    
    // Check if listMessage exists
    if (!listMessage) {
      console.log(`🤖 Interactive list message not found`);
      return;
    }

    // Check if this list message is from an automation
    const metadata = listMessage.metadata as any;
    if (metadata?.automation && metadata?.automationId) {
      const automationId = metadata.automationId;
      const nodeId = metadata.nodeId;
      const executionId = metadata.executionId;
      const rowIds = metadata.rowIds || [];

      console.log(`🤖 Found automation list message:`, {
        automationId,
        nodeId,
        executionId,
        rowCount: rowIds.length,
      });

      // Find the matching row - WhatsApp returns the row ID without 'row_' prefix
      // But we stored it with 'row_' prefix in executeListMessageNode
      const whatsappRowId = selectedId; // This is what WhatsApp returns
      const originalRowId = rowId; // This is what we passed (might be null)

      console.log(`🤖 Looking for row match:`, {
        whatsappRowId,
        originalRowId,
        availableRows: rowIds.map((r: any) => ({
          originalId: r.originalId,
          whatsappId: r.whatsappId,
          title: r.title
        }))
      });

      // Try to find the row by WhatsApp ID first
      let matchedRow = rowIds.find((r: any) => r.whatsappId === whatsappRowId);

      // If not found by WhatsApp ID, try by original ID
      if (!matchedRow && originalRowId) {
        matchedRow = rowIds.find((r: any) => r.originalId === originalRowId);
      }

      // If still not found, try by title (as fallback)
      if (!matchedRow && selectedTitle) {
        matchedRow = rowIds.find((r: any) => r.title === selectedTitle);
      }

      if (matchedRow) {
        console.log(`🤖 Valid selection found:`, matchedRow);

        // Continue the automation execution with the ORIGINAL row ID
        const result = await automationExecutionService.continueFromListSelection(
          automationId,
          contactId,
          userId,
          {
            nodeId: nodeId,
            selectedRowId: matchedRow.originalId, // Use the ORIGINAL row ID
            originalExecutionId: executionId,
            messageId: listMessage.id,
          }
        );

        if (result.success) {
          console.log(`🤖 ✅ Automation continued successfully: ${result.executionId}`);
        } else {
          console.error(`🤖 ❌ Failed to continue automation: ${result.error}`);
        }
      } else if (selectedId) {
        console.warn(`🤖 ⚠️ Selected row not found in list. Trying to use ${selectedId} as row ID...`);

        // If no match found, try to use the selectedId directly
        // Sometimes the row ID might be the actual ID without prefix
        const result = await automationExecutionService.continueFromListSelection(
          automationId,
          contactId,
          userId,
          {
            nodeId: nodeId,
            selectedRowId: selectedId, // Use the WhatsApp row ID directly
            originalExecutionId: executionId,
            messageId: listMessage.id,
          }
        );

        if (result.success) {
          console.log(`🤖 ✅ Automation continued with direct row ID: ${result.executionId}`);
        } else {
          console.error(`🤖 ❌ Failed to continue automation: ${result.error}`);
        }
      }
    } else {
      console.log(`🤖 List message is not from an automation`);
    }

  } catch (error: any) {
    console.error(`🤖 ❌ Error handling automation list selection:`, error);
  }
}

/**
 * Handle automation interactive message button/quick reply selection
 */
async function handleAutomationInteractiveSelection(
  userId: string,
  contactId: string,
  whatsappMessageId: string,
  buttonId: string | undefined,
  buttonTitle: string | undefined,
  conversationId: string,
  interactiveType: 'button_reply' | 'cta_url_reply'
) {
  try {
    const db = getDb();
    
    console.log(`🤖 Checking for automation interactive selection: button=${buttonId}, title=${buttonTitle}, type=${interactiveType}`);
    
    // Find the original interactive message that this is replying to
    const interactiveMessages = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'outgoing'),
          eq(messages.contactId, contactId),
          // Fix 9: Type cast the SQL template literal
          sql`messages.metadata->>'isInteractiveMessage' = 'true'` as any
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(1);
    
    if (interactiveMessages.length === 0) {
      console.log(`🤖 No interactive message found in conversation`);
      return;
    }
    
    const interactiveMessage = interactiveMessages[0];
    
    // Check if interactiveMessage exists
    if (!interactiveMessage) {
      console.log(`🤖 Interactive message not found`);
      return;
    }
    
    // Check if this interactive message is from an automation
    const metadata = interactiveMessage.metadata as any;
    if (metadata?.automation && metadata?.automationId) {
      const automationId = metadata.automationId;
      const nodeId = metadata.nodeId;
      const executionId = metadata.executionId;
      const actions = metadata.actions || [];
      
      // Find the matching action by button ID
      const matchedAction = actions.find((action: any) => 
        action.id === buttonId || 
        `btn_${action.id}` === buttonId ||
        `qr_${action.id}` === buttonId ||
        `action-${action.id}` === buttonId
      );
      
      // If not found by ID, try by title as fallback
      const fallbackAction = !matchedAction && buttonTitle ? actions.find((action: any) => 
        action.title === buttonTitle
      ) : null;
      
      const selectedAction = matchedAction || fallbackAction;
      
      if (selectedAction) {
        console.log(`🤖 Valid action selection found:`, selectedAction);
        
        // Continue the automation execution with the action ID
        const result = await automationExecutionService.continueFromInteractiveAction(
          automationId,
          contactId,
          userId,
          {
            nodeId: nodeId,
            actionId: selectedAction.id, // Use the original action ID
            originalExecutionId: executionId,
            messageId: interactiveMessage.id,
          }
        );
        
        if (result.success) {
          console.log(`🤖 ✅ Automation continued successfully: ${result.executionId}`);
        } else {
          console.error(`🤖 ❌ Failed to continue automation: ${result.error}`);
        }
      } else if (buttonId) {
        console.warn(`🤖 ⚠️ Selected action not found in interactive message. Trying to use ${buttonId} as action ID...`);
        
        // If no match found, try to use the buttonId directly
        const result = await automationExecutionService.continueFromInteractiveAction(
          automationId,
          contactId,
          userId,
          {
            nodeId: nodeId,
            actionId: buttonId, // Use the WhatsApp button ID directly
            originalExecutionId: executionId,
            messageId: interactiveMessage.id,
          }
        );
        
        if (result.success) {
          console.log(`🤖 ✅ Automation continued with direct button ID: ${result.executionId}`);
        } else {
          console.error(`🤖 ❌ Failed to continue automation: ${result.error}`);
        }
      }
    } else {
      console.log(`🤖 Interactive message is not from an automation`);
    }
    
  } catch (error: any) {
    console.error(`🤖 ❌ Error handling automation interactive selection:`, error);
  }
}

/**
 * Check and trigger automations for incoming messages (NEW TRIGGER SYSTEM)
 */
async function checkAndTriggerAutomations(
  contactId: string,
  userId: string,
  messageText: string,
  metadata: any,
  isFirstMessage: boolean = false
) {
  try {
    console.log(`🤖 Checking automations for contact ${contactId}, message: "${messageText.substring(0, 50)}..."`);

    const db = getDb();

    // Find user to get phone number ID
    const [user] = await db.select({
      id: users.id,
      whatsappPhoneNumberId: users.whatsappPhoneNumberId,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.whatsappPhoneNumberId) {
      console.error('❌ User or WhatsApp phone number ID not found');
      return;
    }

    // Check for automation triggers using the new trigger matching service
    const triggerResults = await triggerMatchingService.checkMessageTrigger(
      userId,
      contactId,
      user.whatsappPhoneNumberId,
      messageText,
      isFirstMessage
    );

    console.log(`🤖 Found ${triggerResults.length} automations to execute`);

    // Execute matched automations
    for (const result of triggerResults) {
      console.log(`🚀 Triggering automation: ${result.matchedAutomation.name} (${result.triggerType})`);

      try {
        const executionResult = await automationExecutionService.triggerAutomation(
          result.matchedAutomation.id,
          contactId,
          userId,
          {
            triggerType: result.triggerType,
            message: messageText,
            isFirstMessage,
            matchedKeywords: result.matchedKeywords,
            metadata: metadata,
          }
        );

        if (executionResult.success) {
          console.log(`✅ Automation "${result.matchedAutomation.name}" executed successfully: ${executionResult.executionId}`);
        } else {
          console.error(`❌ Automation "${result.matchedAutomation.name}" failed:`, executionResult.error);
        }
      } catch (error: any) {
        console.error(`❌ Error executing automation "${result.matchedAutomation.name}":`, error.message);
      }
    }

  } catch (error: any) {
    console.error('❌ Error checking automations:', error.message);
  }
}

/**
 * Process message status updates
 */
async function processMessageStatus(status: any) {
  try {
    console.log('📊 Message status update:', JSON.stringify(status, null, 2));

    const db = getDb();

    const [message] = await db.select()
      .from(messages)
      .where(eq(messages.whatsappMessageId, status.id))
      .limit(1);

    if (!message) {
      console.log(`⚠️ Message not found for status update: ${status.id}`);
      return;
    }

    // Check if conversationId exists
    if (!message.conversationId) {
      console.log(`⚠️ Message ${message.id} has no conversation ID, skipping conversation update`);
      
      // Update just the message status
      await db.update(messages)
        .set({
          status: status.status,
        })
        .where(eq(messages.id, message.id));
      
      console.log(`✅ Updated message ${message.id} status to ${status.status}`);
      return;
    }

    const updateData: any = {
      status: status.status,
    };

    // Update the message
    await db.update(messages)
      .set(updateData)
      .where(eq(messages.id, message.id));

    console.log(`✅ Updated message ${message.id} status to ${status.status}`);

    // If message is read, update conversation unread count
    if (status.status === 'read' && message.direction === 'incoming') {
      const [conversation] = await db.select()
        .from(conversations)
        .where(eq(conversations.id, message.conversationId))
        .limit(1);

      if (conversation && conversation.unreadCount && conversation.unreadCount > 0) {
        await db.update(conversations)
          .set({
            unreadCount: Math.max(0, conversation.unreadCount - 1),
          })
          .where(eq(conversations.id, message.conversationId));

        console.log(`✅ Decreased unread count for conversation ${message.conversationId}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error processing message status:', error);
  }
}

// ==================== MEDIA PROCESSING ====================

/**
 * Process media message in background
 */
async function processMediaMessageInBackground(
  message: any,
  messageId: string,
  userId: string,
  contactId: string,
  whatsappPhoneNumberId: string
) {
  try {
    const db = getDb();
    const messageType = message.type;
    const mediaData = message[messageType];

    if (!mediaData?.id) {
      console.error('❌ No media ID found for background processing');

      await db.update(messages)
        .set({
          status: 'failed',
          metadata: {
            processing: false,
            processed: false,
            error: 'No media ID found',
          },
        })
        .where(eq(messages.id, messageId));

      return;
    }

    console.log(`🔄 Starting background media processing for message ${messageId}`);

    // Get user's WhatsApp access token
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.whatsappAccessToken) {
      console.error('❌ User or WhatsApp access token not found');

      await db.update(messages)
        .set({
          status: 'failed',
          metadata: {
            processing: false,
            processed: false,
            error: 'WhatsApp access token not found',
          },
        })
        .where(eq(messages.id, messageId));

      return;
    }

    // Prepare media info for WhatsAppMediaService
    const mediaInfo = {
      id: mediaData.id,
      mime_type: mediaData.mime_type || getMimeTypeFromMessageType(messageType),
      sha256: mediaData.sha256,
      caption: mediaData.caption,
      filename: mediaData.filename,
    };

    // Use the WhatsAppMediaService to process media
    const result = await WhatsAppMediaService.processWhatsAppMedia(
      mediaInfo.id,
      mediaInfo,
      userId,
      messageId,
      user.whatsappAccessToken
    );

    if (result.success && result.mediaAttachment) {
      console.log(`✅ Media uploaded successfully for message ${messageId}`);

      // Update message with media attachment ID and success status
      await db.update(messages)
        .set({
          status: 'delivered',
          body: mediaData.caption || mediaData.filename || `${messageType} message`,
          metadata: {
            type: message.type,
            [message.type]: mediaData,
            processing: false,
            processed: true,
            mediaAttachmentId: result.mediaAttachment.id,
            cloudinaryUrl: result.mediaAttachment.secureUrl,
          },
        })
        .where(eq(messages.id, messageId));

      // Update conversation
      const messageBody = mediaData.caption || mediaData.filename || `${messageType} message`;
      
      // Get conversation ID for the message
      const [messageRecord] = await db.select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (messageRecord?.conversationId) {
        await db.update(conversations)
          .set({
            lastMessage: messageBody,
          })
          .where(eq(conversations.id, messageRecord.conversationId));
      }

    } else {
      console.error(`❌ Media upload failed for message ${messageId}:`, result.error);

      // Update message with error
      await db.update(messages)
        .set({
          status: 'failed',
          metadata: {
            processing: false,
            processed: false,
            error: result.error || 'Unknown error',
          },
          body: `Failed to process ${messageType}`,
        })
        .where(eq(messages.id, messageId));
    }

  } catch (error: any) {
    console.error('❌ Error in background media processing:', error);

    // Update message with error
    const db = getDb();
    await db.update(messages)
      .set({
        status: 'failed',
        metadata: {
          processing: false,
          processed: false,
          error: error.message,
        }
      })
      .where(eq(messages.id, messageId));
  }
}

/**
 * Get mime type from WhatsApp message type
 */
function getMimeTypeFromMessageType(messageType: string): string {
  const mimeTypes: Record<string, string> = {
    'image': 'image/jpeg',
    'video': 'video/mp4',
    'audio': 'audio/mpeg',
    'document': 'application/pdf',
    'sticker': 'image/webp',
  };

  return mimeTypes[messageType] || 'application/octet-stream';
}

// ==================== API ENDPOINTS ====================

/**
 * Send text message endpoint (authenticated)
 * NOTE: This endpoint is kept for backward compatibility
 * Use /conversations/:id/messages instead for sending messages within conversations
 */
router.post('/send', authenticate, async (req: AuthRequest, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    const db = getDb();
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured for this user'
      });
    }

    console.log(`📤 Sending text message to ${phoneNumber} from user ${user.email}`);

    // Find or create contact
    const contact = await ContactsService.findOrCreateFromWhatsApp(
      phoneNumber,
      undefined,
      user.id
    );

    // Use MessageService to send message - FIXED: Add null check for contact
    if (!contact) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create or find contact'
      });
    }

    const result = await messageService.sendMessage({
      contactId: contact.id,
      userId: user.id,
      body: message,
      direction: 'outgoing',
      messageType: 'text',
    });

    console.log(`✅ Text message sent successfully`);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: result.whatsappResponse?.messages?.[0]?.id,
        contact,
        conversation: result.conversation,
        savedMessage: result.message,
      },
    });

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to send message'
    });
  }
});

/**
 * Send media message endpoint (authenticated)
 * NOTE: This endpoint is kept for backward compatibility
 * Use /conversations/:id/messages with attachments instead for sending media within conversations
 */
router.post('/send-media', authenticate, (req: AuthRequest, res) => {
  console.log('📤 Send-media endpoint (busboy) called');

  // Fix 10: Use Busboy constructor properly
  const busboy = (Busboy as any)({
    headers: req.headers,
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
    }
  });

  const fields: Record<string, string> = {};
  let fileBuffer: Buffer | null = null;
  let fileName = '';
  let fileMimeType = '';
  let fileSize = 0;

  // Handle form fields
  busboy.on('field', (fieldname: string, val: string) => {
    console.log(`📝 Field [${fieldname}]: ${val.substring(0, 100)}`);
    fields[fieldname] = val;
  });

  // Handle file upload
  busboy.on('file', (fieldname: string, file: any, info: any) => {
    console.log(`📁 File [${fieldname}]: ${info.filename} (${info.mimeType})`);
    fileName = info.filename;
    fileMimeType = info.mimeType;

    const chunks: Buffer[] = [];
    file.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      fileSize = fileBuffer.length;
      console.log(`✅ File read complete: ${fileName} (${fileSize} bytes)`);
    });

    file.on('error', (err: Error) => {
      console.error('❌ File read error:', err);
    });
  });

  // When all fields and files have been processed
  busboy.on('finish', async () => {
    try {
      console.log('✅ Busboy parsing complete');

      // Extract fields
      const phoneNumber = fields.phoneNumber;
      const caption = fields.caption || '';

      console.log('📊 Parsed data:', { phoneNumber, caption, hasFile: !!fileBuffer });

      // Validate required fields
      if (!fileBuffer || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'File and phone number are required'
        });
      }

      const db = getDb();

      // 1. Get user's WhatsApp configuration
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
        return res.status(400).json({
          success: false,
          error: 'WhatsApp not configured for this user'
        });
      }

      console.log(`📤 Processing media upload for user: ${user.email}`);
      console.log(`📁 File: ${fileName} (${(fileSize / 1024).toFixed(2)} KB, ${fileMimeType})`);

      // 2. Upload file to Cloudinary
      console.log('☁️ Uploading to Cloudinary...');

      const mediaFile = {
        buffer: fileBuffer,
        originalname: fileName,
        mimetype: fileMimeType,
        size: fileSize,
      };

      const cloudinaryResult = await CloudinaryService.uploadFile(mediaFile, {
        folder: `whatsapp_media/user_${user.id}`,
        tags: ['whatsapp', `user_${user.id}`],
        context: {
          uploaded_by: user.email,
          original_filename: fileName,
        },
      });

      if (!cloudinaryResult.success) {
        console.error('❌ Cloudinary upload failed:', cloudinaryResult.error);
        return res.status(500).json({
          success: false,
          error: cloudinaryResult.error || 'Failed to upload to Cloudinary'
        });
      }

      console.log(`✅ Cloudinary upload successful:`);
      console.log(`   URL: ${cloudinaryResult.secureUrl}`);
      console.log(`   Public ID: ${cloudinaryResult.publicId}`);

      // 3. Find or create contact
      let formattedPhone = phoneNumber.replace(/\D/g, '');

      let [contact] = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.phone, formattedPhone),
            eq(contacts.userId, user.id)
          )
        )
        .limit(1);

      if (!contact) {
        // Create new contact - use SQL expressions for timestamps
        [contact] = await db.insert(contacts).values({
          phone: formattedPhone,
          name: `Contact ${formattedPhone}`,
          userId: user.id,
          whatsappPhoneNumberId: user.whatsappPhoneNumberId,
          source: 'whatsapp' as any,
          status: 'active' as any,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        }).returning();
    
      } else {
        console.log(`✅ Found existing contact: ${contact.id}`);
      }

      // Use MessageService to send media message - FIXED: Add null check for contact
      if (!contact) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create contact'
        });
      }

      // Create attachment with proper optional properties
      const attachment: any = {
        url: cloudinaryResult.secureUrl,
        secureUrl: cloudinaryResult.secureUrl,
        mimeType: fileMimeType,
        originalFilename: fileName,
        fileSize: fileSize,
        caption: caption,
      };

      // Add optional properties only if they exist
      if (cloudinaryResult.width !== undefined) {
        attachment.width = cloudinaryResult.width;
      }
      
      if (cloudinaryResult.height !== undefined) {
        attachment.height = cloudinaryResult.height;
      }
      
      if (cloudinaryResult.duration !== undefined) {
        attachment.duration = cloudinaryResult.duration;
      }

      const result = await messageService.sendMessage({
        contactId: contact.id,
        userId: user.id,
        body: caption,
        attachments: [attachment],
        direction: 'outgoing',
        metadata: {
          cloudinaryPublicId: cloudinaryResult.publicId,
        },
      });

      console.log(`✅ All records saved successfully`);

      res.json({
        success: true,
        message: 'Media sent successfully',
        data: {
          cloudinaryUrl: cloudinaryResult.secureUrl,
          whatsappMessageId: result.whatsappResponse?.messages?.[0]?.id,
          message: {
            id: result?.message?.id,
            type: result?.message?.messageType,
            body: result?.message?.body,
          },
          conversation: {
            id: result.conversation.id,
            contactId: result.conversation.contactId,
          },
        },
      });

    } catch (error: any) {
      console.error('❌ Error processing media upload:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to send media'
      });
    }
  });

  // Handle busboy errors
  busboy.on('error', (error: Error) => {
    console.error('❌ Busboy parsing error:', error);
    res.status(400).json({
      success: false,
      error: `Failed to parse form data: ${error}`
    });
  });

  // Handle file limit errors
  busboy.on('filesLimit', () => {
    console.error('❌ File limit exceeded');
    res.status(400).json({
      success: false,
      error: 'File size exceeds limit (50MB)'
    });
  });

  // Pipe the request to busboy
  req.pipe(busboy);
});

/**
 * Get user's WhatsApp configuration
 */
router.get('/config', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const [user] = await db.select({
      whatsappBusinessId: users.whatsappBusinessId,
      whatsappPhoneNumberId: users.whatsappPhoneNumberId,
      whatsappAccessToken: users.whatsappAccessToken,
      email: users.email,
    })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        config: user,
        isConfigured: !!(user.whatsappPhoneNumberId && user.whatsappAccessToken),
      },
    });

  } catch (error: any) {
    console.error('❌ Error getting WhatsApp config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp configuration'
    });
  }
});

/**
 * Update user's WhatsApp configuration
 */
router.post('/config', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      whatsappBusinessId,
      whatsappPhoneNumberId,
      whatsappAccessToken
    } = req.body;

    if (!whatsappPhoneNumberId || !whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Phone number ID and access token are required'
      });
    }

    const db = getDb();

    await db.update(users)
      .set({
        whatsappBusinessId: whatsappBusinessId || null,
        whatsappPhoneNumberId,
        whatsappAccessToken,
      })
      .where(eq(users.id, req.user!.userId));

    console.log(`✅ WhatsApp configuration updated for user ${req.user!.userId}`);

    res.json({
      success: true,
      message: 'WhatsApp configuration updated successfully',
    });

  } catch (error: any) {
    console.error('❌ Error updating WhatsApp config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update WhatsApp configuration'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Test WhatsApp configuration
    let whatsappStatus = 'not_configured';
    if (user.whatsappPhoneNumberId && user.whatsappAccessToken) {
      try {
        await WhatsAppService.getBusinessProfile(
          user.whatsappPhoneNumberId,
          user.whatsappAccessToken
        );
        whatsappStatus = 'connected';
      } catch (error) {
        whatsappStatus = 'error';
        console.warn('⚠️ WhatsApp connection test failed:', error);
      }
    }

    // Test Cloudinary configuration
    let cloudinaryStatus = 'not_configured';
    if (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET) {
      try {
        await CloudinaryService.createFolder('test_connection');
        cloudinaryStatus = 'connected';
      } catch (error) {
        cloudinaryStatus = 'error';
       
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
        },
        services: {
          whatsapp: whatsappStatus,
          cloudinary: cloudinaryStatus,
          database: 'connected',
        },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

export default router;