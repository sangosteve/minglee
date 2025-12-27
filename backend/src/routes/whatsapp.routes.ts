// backend/src/routes/whatsapp.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { WhatsAppService, WhatsAppWebhookEvent } from '../services/whatsapp.service';
import { CloudinaryService, MediaFile } from '../services/cloudinary.service';
import { WhatsAppMediaService } from '../services/whatsapp-media.service';
import { automationExecutionService } from '../services/automation-execution.service';
import { ContactsService } from '../services/contacts.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { users, contacts, conversations, messages, mediaAttachments,automations } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import Busboy from 'busboy';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept images, videos, audio, and documents
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/zip'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});


/**
 * Check and trigger automations for incoming messages
 */
async function checkAndTriggerAutomations(
  contactId: string, 
  userId: string, 
  messageText: string,
  metadata: any  // Now includes conversation_id
) {
  try {
    console.log(`🤖 Checking automations for contact ${contactId}, message: "${messageText}"`);
    console.log(`📊 Metadata:`, metadata);
    
    const db = getDb();
    
    // 1. Find all active automations with "message_received" trigger
    const activeAutomations = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.userId, userId),
        eq(automations.status, 'active'),
        eq(automations.triggerType, 'message_received')
      ));

    console.log(`🔍 Found ${activeAutomations.length} active message_received automations`);

    for (const automation of activeAutomations) {
      const triggerConfig = automation.triggerConfig || {};
      
      // 2. Check trigger conditions
      const shouldTrigger = evaluateTriggerConditions(messageText, triggerConfig);
      
      if (shouldTrigger) {
        console.log(`🚀 Triggering automation: ${automation.name} (${automation.id})`);
        console.log(`💬 Using conversation: ${metadata.conversation_id}`);
        
        // 3. Execute the automation (in background, don't await)
        automationExecutionService.executeWorkflow(
          automation.id,
          contactId,
          userId,
          {
            trigger_type: 'message_received',
            message_text: messageText,
            received_at: new Date().toISOString(),
            metadata: metadata,
            conversation_id: metadata.conversation_id,  // Pass to execution
            saved_message_id: metadata.saved_message_id,
          }
        ).then(result => {
          if (result.success) {
            console.log(`✅ Automation ${automation.name} executed successfully: ${result.executionId}`);
          } else {
            console.error(`❌ Automation ${automation.name} failed:`, result.error);
          }
        }).catch(error => {
          console.error(`❌ Automation execution error for ${automation.name}:`, error);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking automations:', error);
  }
}

/**
 * Helper function to evaluate trigger conditions
 */
function evaluateTriggerConditions(messageText: string, triggerConfig: any): boolean {
  // Default: trigger on all messages if no config
  if (!triggerConfig || Object.keys(triggerConfig).length === 0) {
    return true;
  }

  const messageLower = messageText.toLowerCase();
  
  // Check for keyword triggers
  if (triggerConfig.keywords && Array.isArray(triggerConfig.keywords)) {
    for (const keyword of triggerConfig.keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        console.log(`✅ Keyword match: "${keyword}" in message`);
        return true;
      }
    }
  }
  
  // Check for exact match
  if (triggerConfig.exactMatch && messageText === triggerConfig.exactMatch) {
    console.log(`✅ Exact match: "${triggerConfig.exactMatch}"`);
    return true;
  }
  
  // Check for regex pattern
  if (triggerConfig.regexPattern) {
    try {
      const regex = new RegExp(triggerConfig.regexPattern, 'i');
      if (regex.test(messageText)) {
        console.log(`✅ Regex match: "${triggerConfig.regexPattern}"`);
        return true;
      }
    } catch (error) {
      console.error('Invalid regex pattern:', triggerConfig.regexPattern);
    }
  }
  
  // If specific config exists but no match, return false
  return false;
}
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

    console.log(req.body)

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

        // Extract metadata - CRITICAL: These are needed to route the message
        const metadata = value.metadata;
        if (!metadata?.display_phone_number || !metadata?.phone_number_id) {
          console.error('❌ Missing critical metadata in webhook:', metadata);
          continue;
        }

        // 1. Process incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          console.log(`📨 Found ${value.messages.length} incoming message(s)`);
          for (const message of value.messages) {
            // Call your existing processIncomingMessage function
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

        // 3. Process contact info (if present)
        if (value.contacts && Array.isArray(value.contacts)) {
          console.log(`👤 Found ${value.contacts.length} contact(s) in webhook`);
          // Contacts are already handled in processIncomingMessage
        }
      }
    }

    console.log('✅ Webhook event processing completed');
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
  }
}

/**
 * Helper function to get last message text for conversation
 */
function getLastMessageText(message: any): string {
  const messageType = message.type;
  
  if (message.text?.body) {
    return message.text.body.substring(0, 100);
  }
  
  if (message[messageType]?.caption) {
    return `${messageType}: ${message[messageType].caption.substring(0, 50)}`;
  }
  
  if (messageType === 'document' && message.document?.filename) {
    return `Document: ${message.document.filename}`;
  }
  
  if (messageType === 'location' && message.location?.name) {
    return `Location: ${message.location.name}`;
  }
  
  if (message.interactive?.list_reply?.title) {
    return `Selected: ${message.interactive.list_reply.title}`;
  }
  
  if (message.interactive?.button_reply?.title) {
    return `Clicked: ${message.interactive.button_reply.title}`;
  }
  
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
  };
  
  return typeLabels[messageType] || 'Message';
}


/**
 * Process media message in background
 */
async function processMediaMessageInBackground(
  message: any,
  messageId: string, // This is the saved message ID
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
      
      // Update message status to indicate failure
      await db.update(messages)
        .set({
          status: 'failed',
          metadata: {
            processing: false,
            processed: false,
            error: 'No media ID found',
          },
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));
      
      return;
    }
    
    console.log(`🔄 Starting background media processing for message ${messageId}`);
    console.log(`📊 Media info:`, {
      type: messageType,
      id: mediaData.id,
      mime_type: mediaData.mime_type,
      caption: mediaData.caption,
      filename: mediaData.filename,
    });
    
    // Get user's WhatsApp access token
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userResult.length === 0 || !userResult[0].whatsappAccessToken) {
      console.error('❌ User or WhatsApp access token not found');
      
      await db.update(messages)
        .set({
          status: 'failed',
          metadata: {
            processing: false,
            processed: false,
            error: 'WhatsApp access token not found',
          },
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));
      
      return;
    }
    
    const user = userResult[0];
    
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
      messageId, // Pass the message ID to link the media attachment
      user.whatsappAccessToken // Pass the access token
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
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));
      
      // Also update the message's mediaAttachmentId field if it exists in schema
      try {
        await db.update(messages)
          .set({
            mediaAttachmentId: result.mediaAttachment.id,
          })
          .where(eq(messages.id, messageId));
      } catch (e) {
        // Field might not exist, that's okay
      }
      
      if (result.mediaAttachment.secureUrl) {
        console.log(`📁 Cloudinary URL: ${result.mediaAttachment.secureUrl}`);
      }
      
      // Update conversation with the actual message content
      const messageBody = mediaData.caption || mediaData.filename || `${messageType} message`;
      await db.update(conversations)
        .set({
          lastMessage: messageBody,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, 
          (await db.select({ conversationId: messages.conversationId })
            .from(messages)
            .where(eq(messages.id, messageId))
            .limit(1)
          )[0]?.conversationId
        ));
      
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
          updatedAt: new Date(),
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
        },
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));
  }
}


/**
 * Helper function to update message metadata properly
 */
async function updateMessageMetadata(messageId: string, metadataUpdate: any) {
  const db = getDb();
  
  // First get current metadata
  const messageResult = await db.select({ metadata: messages.metadata })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  
  if (messageResult.length === 0) {
    throw new Error(`Message ${messageId} not found`);
  }
  
  const currentMetadata = messageResult[0].metadata || {};
  const newMetadata = { ...currentMetadata, ...metadataUpdate };
  
  await db.update(messages)
    .set({
      metadata: newMetadata,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId));
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

/**
 * Process incoming message
 */
/**
 * Process incoming message
 */
async function processIncomingMessage(
  message: any,
  metadata: { display_phone_number: string; phone_number_id: string }
) {
  try {
    console.log('📨 Processing incoming message:', JSON.stringify(message, null, 2));
    console.log('📊 Metadata:', JSON.stringify(metadata, null, 2));
    
    const whatsappPhoneNumberId = metadata.phone_number_id;
    const businessPhoneNumber = metadata.display_phone_number;
    
    console.log(`🏢 Business: ${businessPhoneNumber} (ID: ${whatsappPhoneNumberId})`);
    console.log(`📞 Sender: ${message.from}`);
    console.log(`💬 Message type: ${message.type}`);
    
    if (message.text?.body) {
      console.log(`📝 Text message: ${message.text.body.substring(0, 100)}...`);
    }
    
    if (message.contacts?.[0]) {
      console.log('👤 Contact info from WhatsApp:', message.contacts[0]);
    }
    
    const db = getDb();
    
    // 1. Find user who owns this WhatsApp number
    let userResult = await db.select()
      .from(users)
      .where(eq(users.whatsappPhoneNumberId, whatsappPhoneNumberId))
      .limit(1);
    
    let user;
    
    if (userResult.length === 0) {
      console.log(`👤 No user found for WhatsApp business ID: ${whatsappPhoneNumberId}`);
      console.log(`🔍 Checking environment variables...`);
      
      const envWhatsAppPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const envWhatsAppAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      
      if (whatsappPhoneNumberId === envWhatsAppPhoneNumberId) {
        console.log(`✅ WhatsApp number matches environment variable`);
        
        userResult = await db.select()
          .from(users)
          .where(
            and(
              eq(users.whatsappPhoneNumberId, envWhatsAppPhoneNumberId),
              eq(users.whatsappAccessToken, envWhatsAppAccessToken)
            )
          )
          .limit(1);
        
        if (userResult.length === 0) {
          console.log(`👤 No user found with environment WhatsApp config, updating first user...`);
          
          // Get first admin user or any user
          const adminUsers = await db.select()
            .from(users)
            .where(eq(users.isAdmin, true))
            .orderBy(users.createdAt)
            .limit(1);
          
          if (adminUsers.length > 0) {
            user = adminUsers[0];
            
            await db.update(users)
              .set({
                whatsappPhoneNumberId: envWhatsAppPhoneNumberId,
                whatsappAccessToken: envWhatsAppAccessToken,
                whatsappBusinessId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id));
            
            console.log(`✅ Updated admin user ${user.email} with WhatsApp config`);
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
            
            await db.update(users)
              .set({
                whatsappPhoneNumberId: envWhatsAppPhoneNumberId,
                whatsappAccessToken: envWhatsAppAccessToken,
                whatsappBusinessId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id));
            
            console.log(`✅ Updated user ${user.email} with WhatsApp config`);
          }
        } else {
          user = userResult[0];
        }
      } else {
        console.log(`🔄 Falling back to any user with WhatsApp config...`);
        
        const usersWithWhatsApp = await db.select()
          .from(users)
          .where(eq(users.whatsappPhoneNumberId, whatsappPhoneNumberId))
          .limit(1);
        
        if (usersWithWhatsApp.length > 0) {
          user = usersWithWhatsApp[0];
        } else {
          const defaultUser = await db.select()
            .from(users)
            .where(eq(users.isAdmin, true))
            .orderBy(users.createdAt)
            .limit(1);
          
          if (defaultUser.length > 0) {
            user = defaultUser[0];
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
          
          console.log(`👤 Using user: ${user.email} (ID: ${user.id})`);
        }
      }
    } else {
      user = userResult[0];
      console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    }
    
    // 2. Find or create contact
    const senderPhoneNumber = message.from;
    let formattedPhone = senderPhoneNumber.replace(/\D/g, '');
    
    console.log(`📱 Phone number processing:`, {
      original: senderPhoneNumber,
      formatted: formattedPhone,
      length: formattedPhone.length
    });
    
    const senderName = message.contacts?.[0]?.profile?.name || `Contact ${formattedPhone}`;
    
    console.log(`🔍 Looking for contact with phone: ${formattedPhone} for user ${user.id}`);
    
    let contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, formattedPhone),
          eq(contacts.userId, user.id)
        )
      )
      .limit(1);
    
    let contact;
    
    if (contactResult.length === 0) {
      console.log(`➕ Creating new contact: ${senderName} (${formattedPhone})`);
      
      const contactData: any = {
        phone: formattedPhone,
        name: senderName,
        email: '',
        note: `WhatsApp contact created on ${new Date().toISOString()}`,
        userId: user.id,
        whatsappBusinessId: user.whatsappBusinessId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        whatsappPhoneNumberId: whatsappPhoneNumberId,
        tags: [],
        isActive: true,
        source: 'whatsapp' as any,
        status: 'active' as any,
        optIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      try {
        const [newContact] = await db.insert(contacts).values(contactData).returning();
        contact = newContact;
        console.log(`✅ Contact created: ${contact.name} (ID: ${contact.id})`);
      } catch (insertError: any) {
        console.error('❌ Error creating contact:', insertError);
        
        const minimalContactData = {
          phone: formattedPhone,
          name: senderName,
          userId: user.id,
          source: 'whatsapp' as any,
          status: 'active' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const [newContact] = await db.insert(contacts).values(minimalContactData).returning();
        contact = newContact;
        console.log(`✅ Contact created with minimal data: ${contact.name} (ID: ${contact.id})`);
      }
    } else {
      contact = contactResult[0];
      console.log(`✅ Found existing contact: ${contact.name} (ID: ${contact.id})`);
      
      // Update contact with WhatsApp info if missing
      if (!contact.whatsappPhoneNumberId || !contact.whatsappBusinessId) {
        await db.update(contacts)
          .set({
            whatsappBusinessId: user.whatsappBusinessId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
            whatsappPhoneNumberId: whatsappPhoneNumberId,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id));
        console.log(`✅ Updated contact with WhatsApp info`);
      }
    }
    
    // 3. Find or create conversation
    console.log(`🔍 Looking for conversation for contact ${contact.id} and WhatsApp ID ${whatsappPhoneNumberId}`);
    
    let conversationResult = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.contactId, contact.id),
          eq(conversations.whatsappPhoneNumberId, whatsappPhoneNumberId)
        )
      )
      .limit(1);
    
    let conversation;
    
    if (conversationResult.length === 0) {
      console.log(`➕ Creating new conversation for contact ${contact.id}`);
      
      const lastMessage = getLastMessageText(message);
      
      const conversationData = {
        contactId: contact.id,
        userId: user.id,
        whatsappPhoneNumberId: whatsappPhoneNumberId,
        lastMessage: lastMessage,
        lastMessageAt: new Date(),
        unreadCount: 1,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const [newConversation] = await db.insert(conversations).values(conversationData).returning();
      conversation = newConversation;
      console.log(`✅ Conversation created: ID ${conversation.id}`);
    } else {
      conversation = conversationResult[0];
      
      const lastMessage = getLastMessageText(message);
      await db.update(conversations)
        .set({
          lastMessage: lastMessage,
          lastMessageAt: new Date(),
          unreadCount: conversation.unreadCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));
      
      console.log(`✅ Updated conversation: ID ${conversation.id}`);
    }
    
    // 4. Handle different message types
    const timestamp = new Date();
    let savedMessage;
    
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    const isMediaMessage = mediaTypes.includes(message.type);
    
    if (isMediaMessage && message[message.type]?.id) {
      console.log(`📁 Processing ${message.type} media message`);
      
      // ==================== UPDATED SECTION ====================
      // STEP 1: Save message with "processing" flag FIRST
      const messageData: any = {
        contactId: contact.id,
        conversationId: conversation.id,
        whatsappMessageId: message.id,
        direction: 'incoming',
        messageType: message.type,
        status: 'processing', // Initial status
        timestamp: timestamp,
        metadata: {
          type: message.type,
          [message.type]: message[message.type],
          processing: true,
          processed: false,
          whatsappMediaId: message[message.type].id,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Add caption if available
      if (message[message.type]?.caption) {
        messageData.body = message[message.type].caption;
      } else if (message.type === 'document' && message.document?.filename) {
        messageData.body = message.document.filename;
      } else {
        messageData.body = `${message.type} message`;
      }
      
      // Save message to database FIRST
      const [newMessage] = await db.insert(messages).values(messageData).returning();
      savedMessage = newMessage;
      console.log(`✅ Message saved with ID: ${savedMessage.id}`);
      
      // ==================== STEP 2: Process media asynchronously ====================
      // Start background processing WITHOUT AWAITING
      processMediaMessageInBackground(
        message,
        savedMessage.id, // Pass the saved message ID
        user.id,
        contact.id,
        whatsappPhoneNumberId
      ).catch(error => {
        console.error(`❌ Background media processing failed for message ${savedMessage.id}:`, error);
      });
      
      console.log(`🔄 Media processing started in background for message ${savedMessage.id}`);
      
    } else {
      // Non-media message handling
      console.log(`💾 Saving ${message.type} message`);
      
      const messageData: any = {
        contactId: contact.id,
        conversationId: conversation.id,
        whatsappMessageId: message.id,
        direction: 'incoming',
        messageType: message.type,
        status: 'received',
        timestamp: timestamp,
        metadata: {
          type: message.type,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Add content based on message type
      if (message.text?.body) {
        messageData.body = message.text.body;
        messageData.metadata.text = message.text;
      } else if (message.type === 'location' && message.location) {
        messageData.body = message.location.name || 'Location shared';
        messageData.metadata.location = message.location;
      } else if (message.interactive) {
        messageData.body = message.interactive[message.interactive.type]?.title || 'Interactive message';
        messageData.metadata.interactive = message.interactive;
      } else if (message.button) {
        messageData.body = message.button.text || 'Button message';
        messageData.metadata.button = message.button;
      } else if (message.contacts) {
        messageData.body = 'Contact shared';
        messageData.metadata.contacts = message.contacts;
      } else {
        messageData.body = `${message.type} message`;
      }
      
      [savedMessage] = await db.insert(messages).values(messageData).returning();
      console.log(`✅ Message saved: ID ${savedMessage.id}`);
    }
    
    // 5. Optional: Mark message as read
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

    if (message.text?.body && savedMessage && contact && user) {
      console.log(`📨 Checking automations for incoming message: "${message.text.body.substring(0, 50)}..."`);
      
      // Trigger automations in the background (don't await)
     checkAndTriggerAutomations(
    contact.id,
    user.id,
    message.text.body,
    {
      whatsapp_message_id: message.id,
      sender: message.from,
      timestamp: message.timestamp,
      message_type: message.type,
      phone_number_id: metadata.phone_number_id,
      business_phone_number: metadata.display_phone_number,
      conversation_id: conversation.id,  // ← PASS CONVERSATION ID!
      saved_message_id: savedMessage.id, // ← PASS MESSAGE ID TOO!
    }
  ).catch(error => {
    console.error('❌ Background automation trigger failed:', error);
  });
    }
    
    console.log(`✅ Message processing complete for ${senderName}`);
    console.log('---');
    
  } catch (error: any) {
    console.error('❌ Error processing incoming message:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', JSON.stringify(error, null, 2));
  }
}
/**
 * Process message status updates
 */
async function processMessageStatus(status: any) {
  try {
    console.log('📊 Message status update:', JSON.stringify(status, null, 2));
    
    const db = getDb();
    
    const messageResult = await db.select()
      .from(messages)
      .where(eq(messages.whatsappMessageId, status.id))
      .limit(1);
    
    if (messageResult.length === 0) {
      console.log(`⚠️ Message not found for status update: ${status.id}`);
      return;
    }
    
    const message = messageResult[0];
    const updateData: any = {
      status: status.status,
      updatedAt: new Date(),
    };
    
    // Set timestamps based on status
    if (status.status === 'delivered') {
      updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
    } else if (status.status === 'read') {
      updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
    }
    
    // Update the message
    await db.update(messages)
      .set(updateData)
      .where(eq(messages.id, message.id));
    
    console.log(`✅ Updated message ${message.id} status to ${status.status}`);
    
    // If message is read, update conversation unread count
    if (status.status === 'read' && message.direction === 'incoming') {
      const conversation = await db.select()
        .from(conversations)
        .where(eq(conversations.id, message.conversationId))
        .limit(1);
      
      if (conversation.length > 0 && conversation[0].unreadCount > 0) {
        await db.update(conversations)
          .set({
            unreadCount: Math.max(0, conversation[0].unreadCount - 1),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, message.conversationId));
        
        console.log(`✅ Decreased unread count for conversation ${message.conversationId}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error processing message status:', error);
  }
}

// ==================== API ENDPOINTS ====================

/**
 * Send text message endpoint (authenticated)
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
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const user = userResult[0];
    
    if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp not configured for this user' 
      });
    }
    
    console.log(`📤 Sending text message to ${phoneNumber} from user ${user.email}`);
    
    const result = await WhatsAppService.sendTextMessage(
      user.whatsappPhoneNumberId,
      phoneNumber,
      message,
      user.whatsappAccessToken
    );
    
    // Find or create contact
    const contact = await ContactsService.findOrCreateFromWhatsApp(
      phoneNumber,
      undefined,
      user.id
    );
    
    // Find or create conversation
    const conversation = await ContactsService.findOrCreateConversation(
      contact.id,
      user.whatsappPhoneNumberId,
      user.id
    );
    
    // Save outgoing message
    const savedMessage = await ContactsService.saveIncomingMessage(
      {
        id: result.messages?.[0]?.id || `temp-${Date.now()}`,
        from: phoneNumber,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'text',
        text: { body: message },
      },
      contact.id,
      conversation.id,
      'outgoing'
    );
    
    console.log(`✅ Text message sent successfully`);
    
    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: result.messages?.[0]?.id,
        contact,
        conversation,
        savedMessage,
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
router.post('/send-media', authenticate, (req: AuthRequest, res) => {
  console.log('📤 Send-media endpoint (busboy) called');
  
  // Create busboy instance to parse multipart/form-data
  const busboy = Busboy({ 
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
  busboy.on('field', (fieldname, val) => {
    console.log(`📝 Field [${fieldname}]: ${val.substring(0, 100)}`);
    fields[fieldname] = val;
  });
  
  // Handle file upload
  busboy.on('file', (fieldname, file, info) => {
    console.log(`📁 File [${fieldname}]: ${info.filename} (${info.mimeType})`);
    fileName = info.filename;
    fileMimeType = info.mimeType;
    
    const chunks: Buffer[] = [];
    file.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      fileSize = fileBuffer.length;
      console.log(`✅ File read complete: ${fileName} (${fileSize} bytes)`);
    });
    
    file.on('error', (err) => {
      console.error('❌ File read error:', err);
    });
  });
  
  // When all fields and files have been processed
  busboy.on('finish', async () => {
    try {
      console.log('✅ Busboy parsing complete');
      console.log('Fields:', JSON.stringify(fields, null, 2));
      console.log('Has file?', !!fileBuffer);
      
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
      
      // ========== EXISTING BUSINESS LOGIC ==========
      const db = getDb();
      
      // 1. Get user's WhatsApp configuration
      const userResult = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1);
      
      if (userResult.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const user = userResult[0];
      
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
      console.log(`   Size: ${(cloudinaryResult.fileSize / 1024).toFixed(2)} KB`);

      // 3. Determine WhatsApp media type from file type
      let whatsappMediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
      
      if (fileMimeType.startsWith('image/')) {
        whatsappMediaType = 'image';
      } else if (fileMimeType.startsWith('video/')) {
        whatsappMediaType = 'video';
      } else if (fileMimeType.startsWith('audio/')) {
        whatsappMediaType = 'audio';
      }

      console.log(`📤 Sending via WhatsApp (${whatsappMediaType}) to ${phoneNumber}...`);
      
      // 4. Send media message via WhatsApp
      const whatsappResult = await WhatsAppService.sendMediaMessage(
        user.whatsappPhoneNumberId,
        phoneNumber,
        cloudinaryResult.secureUrl,
        whatsappMediaType,
        caption,
        fileName,
        user.whatsappAccessToken
      );

      console.log(`✅ WhatsApp message sent successfully`);
      console.log(`   Message ID: ${whatsappResult.messages?.[0]?.id}`);

      // 5. Find or create contact
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      
      let contactResult = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.phone, formattedPhone),
            eq(contacts.userId, user.id)
          )
        )
        .limit(1);
      
      let contact;
      
      if (contactResult.length === 0) {
        // Create new contact
        const [newContact] = await db.insert(contacts).values({
          phone: formattedPhone,
          name: `Contact ${formattedPhone}`,
          userId: user.id,
          whatsappPhoneNumberId: user.whatsappPhoneNumberId,
          source: 'whatsapp' as any,
          status: 'active' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        contact = newContact;
        console.log(`✅ Contact created: ${contact.id}`);
      } else {
        contact = contactResult[0];
        console.log(`✅ Found existing contact: ${contact.id}`);
      }
      
      // 6. Find or create conversation
      let conversationResult = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.contactId, contact.id),
            eq(conversations.whatsappPhoneNumberId, user.whatsappPhoneNumberId)
          )
        )
        .limit(1);
      
      let conversation;
      
      if (conversationResult.length === 0) {
        const [newConversation] = await db.insert(conversations).values({
          contactId: contact.id,
          userId: user.id,
          whatsappPhoneNumberId: user.whatsappPhoneNumberId,
          lastMessage: caption || fileName,
          lastMessageAt: new Date(),
          unreadCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        conversation = newConversation;
        console.log(`✅ Conversation created: ${conversation.id}`);
      } else {
        conversation = conversationResult[0];
        
        // Update conversation
        await db.update(conversations)
          .set({
            lastMessage: caption || fileName,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversation.id));
        
        console.log(`✅ Updated conversation: ${conversation.id}`);
      }

      // ==================== CRITICAL FIX: SAVE IN CORRECT ORDER ====================

      // 7. Save message record FIRST (so we have a message ID)
      console.log('💾 Saving message record first...');
      const [savedMessage] = await db.insert(messages).values({
        conversationId: conversation.id,
        contactId: contact.id,
        whatsappMessageId: whatsappResult.messages?.[0]?.id || `temp_${Date.now()}`,
        direction: 'outgoing',
        messageType: whatsappMediaType,
        body: caption || fileName,
        status: 'sent',
         timestamp: whatsappResult.messages?.[0]?.timestamp 
    ? new Date(Number(whatsappResult.messages?.[0]?.timestamp) * 1000)
    : new Date(),
        // Don't set mediaAttachmentId yet - we'll update it after
        metadata: {
          cloudinaryUrl: cloudinaryResult.secureUrl,
          originalFilename: fileName,
          fileSize: fileSize,
          mediaType: whatsappMediaType,
          whatsappMessageId: whatsappResult.messages?.[0]?.id,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      console.log(`💾 Message saved: ${savedMessage.id}`);

      // 8. Save media attachment record WITH the message_id
      console.log('💾 Saving media attachment with message_id...');
      const [mediaAttachment] = await db.insert(mediaAttachments).values({
        publicId: cloudinaryResult.publicId,
        secureUrl: cloudinaryResult.secureUrl,
        originalFilename: fileName,
        mimeType: fileMimeType,
        fileSize: fileSize,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        duration: cloudinaryResult.duration || null,
        format: cloudinaryResult.format,
        resourceType: cloudinaryResult.resourceType,
        caption: caption,
        tags: ['whatsapp', 'outgoing', `type_${whatsappMediaType}`],
        thumbnailUrl: CloudinaryService.generateThumbnailUrl(cloudinaryResult.publicId),
        uploadedByUserId: user.id,
        messageId: savedMessage.id, // ← LINK TO MESSAGE (CRITICAL!)
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      console.log(`💾 Media attachment saved: ${mediaAttachment.id}`);

      // 9. Update the message with the media attachment ID
      console.log('💾 Updating message with media attachment ID...');
    try {
  await db.update(messages)
    .set({
      mediaAttachmentId: mediaAttachment.id,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, savedMessage.id));
  console.log(`✅ Message updated with media attachment ID: ${mediaAttachment.id}`);
} catch (updateError: any) {
  console.error('❌ Failed to update message with media attachment ID:', updateError);
  // Continue anyway - the message was saved successfully
}

      console.log(`✅ Message updated with media attachment ID: ${mediaAttachment.id}`);

      // 10. Update conversation (again with latest timestamp)
      console.log('💾 Updating conversation...');
      await db.update(conversations)
        .set({
          lastMessage: caption || fileName,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));

      console.log(`✅ All records saved successfully`);

      // ==================== RESPONSE ====================

      res.json({
        success: true,
        message: 'Media sent successfully',
        data: {
          cloudinaryUrl: cloudinaryResult.secureUrl,
          whatsappMessageId: whatsappResult.messages?.[0]?.id,
          mediaAttachment: {
            id: mediaAttachment.id,
            publicId: mediaAttachment.publicId,
            secureUrl: mediaAttachment.secureUrl,
          },
          message: {
            id: savedMessage.id,
            type: savedMessage.messageType,
            body: savedMessage.body,
          },
          conversation: {
            id: conversation.id,
            contactId: conversation.contactId,
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
  busboy.on('error', (error) => {
    console.error('❌ Busboy parsing error:', error);
    res.status(400).json({ 
      success: false,
      error: `Failed to parse form data: ${error.message}` 
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
  
  // Handle fields limit errors
  busboy.on('fieldsLimit', () => {
    console.error('❌ Fields limit exceeded');
    res.status(400).json({ 
      success: false,
      error: 'Too many form fields' 
    });
  });
  
  // Handle parts limit errors
  busboy.on('partsLimit', () => {
    console.error('❌ Parts limit exceeded');
    res.status(400).json({ 
      success: false,
      error: 'Too many form parts' 
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
    const userResult = await db.select({
      whatsappBusinessId: users.whatsappBusinessId,
      whatsappPhoneNumberId: users.whatsappPhoneNumberId,
      whatsappAccessToken: users.whatsappAccessToken,
      email: users.email,
    })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const config = userResult[0];
    
    res.json({
      success: true,
      data: {
        config,
        isConfigured: !!(config.whatsappPhoneNumberId && config.whatsappAccessToken),
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
        updatedAt: new Date(),
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
 * Get conversations for user
 */
router.get('/conversations', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const db = getDb();
    
    const conversationsList = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, req.user!.userId))
      .orderBy(conversations.lastMessageAt)
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(conversations)
      .where(eq(conversations.userId, req.user!.userId));
    
    const total = Number(totalResult[0]?.count || 0);

    res.json({
      success: true,
      data: {
        conversations: conversationsList,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch conversations' 
    });
  }
});

/**
 * Get messages for conversation
 */
router.get('/conversations/:conversationId/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const db = getDb();
    
    // Verify conversation belongs to user
    const conversationResult = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, req.user!.userId)
        )
      )
      .limit(1);
    
    if (conversationResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }

    const messagesList = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp)
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    
    const total = Number(totalResult[0]?.count || 0);

    res.json({
      success: true,
      data: {
        messages: messagesList,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch messages' 
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const user = userResult[0];
    
    // Test WhatsApp configuration
    let whatsappStatus = 'not_configured';
    if (user.whatsappPhoneNumberId && user.whatsappAccessToken) {
      try {
        // Try to get business profile (simple API call)
        await WhatsAppService.getBusinessProfile(
          user.whatsappPhoneNumberId,
          user.whatsappAccessToken
        );
        whatsappStatus = 'connected';
      } catch (error) {
        whatsappStatus = 'error';
        console.warn('⚠️ WhatsApp connection test failed:', error.message);
      }
    }
    
    // Test Cloudinary configuration
    let cloudinaryStatus = 'not_configured';
    if (process.env.CLOUDINARY_CLOUD_NAME && 
        process.env.CLOUDINARY_API_KEY && 
        process.env.CLOUDINARY_API_SECRET) {
      try {
        // Create a test folder
        await CloudinaryService.createFolder('test_connection');
        cloudinaryStatus = 'connected';
      } catch (error) {
        cloudinaryStatus = 'error';
        console.warn('⚠️ Cloudinary connection test failed:', error.message);
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