// backend/src/services/message.service.ts
import { getDb } from '../../db/client';
import { messages, conversations, contacts, users, mediaAttachments } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { WhatsAppService } from '../whatsapp.service';
import { v4 as uuidv4 } from 'uuid';
import { triggerMatchingService } from '../trigger-matching.service';
import { automationExecutionService } from '../automation-execution.service';

export interface SendMessageParams {
  conversationId?: string;
  contactId: string;
  userId: string;
  body: string;
  attachments?: Array<{
    id?: string;
    url: string;
    secureUrl: string;
    mimeType: string;
    originalFilename?: string;
    filename?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    caption?: string;
    providerId?: string;
    provider?: string;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
  direction: 'incoming' | 'outgoing';
  messageType?: string;
}

export interface SaveMessageParams {
  conversationId: string;
  contactId: string;
  whatsappMessageId?: string;
  direction: 'incoming' | 'outgoing';
  messageType: string;
  body: string;
  status: string;
  metadata?: Record<string, any>;
}

export class MessageService {
  /**
   * Handle incoming message and check for automation triggers
   */
  async handleIncomingMessage(
    whatsappMessageId: string,
    phoneNumberId: string,
    fromNumber: string,
    messageBody: string,
    messageType: string = 'text',
    metadata?: any
  ) {
    const db = getDb();
    
    try {
      console.log(`[Incoming] Handling message from ${fromNumber}: "${messageBody}"`);
      
      // 1. Find user by phone number ID
      const [user] = await db.select()
        .from(users)
        .where(eq(users.whatsappPhoneNumberId, phoneNumberId))
        .limit(1);
      
      if (!user) {
        console.error('[Incoming] User not found for phone number ID:', phoneNumberId);
        return { success: false, error: 'User not found' };
      }
      
      // 2. Find or create contact
      let [contact] = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.phone, fromNumber),
            eq(contacts.userId, user.id)
          )
        )
        .limit(1);
      
      if (!contact) {
        // Create new contact
        console.log('[Incoming] Creating new contact for', fromNumber);
        const [newContact] = await db.insert(contacts).values({
          id: uuidv4(),
          userId: user.id,
          phone: fromNumber,
          name: fromNumber, // Can be updated later
          status: 'active',
          source: 'whatsapp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning();
        
        contact = newContact!;
      }
      
      // 3. Check if this is the first message
      const isFirstMessage = await triggerMatchingService.isFirstMessage(
        user.id,
        contact.id,
        phoneNumberId
      );
      
      console.log(`[Incoming] Is first message: ${isFirstMessage}`);
      
      // 4. Save the incoming message
      const conversation = await this.getOrCreateConversation(
        contact.id,
        user.id,
        phoneNumberId
      );
      
      const savedMessage = await this.saveMessage({
        conversationId: conversation.id,
        contactId: contact.id,
        whatsappMessageId,
        direction: 'incoming',
        messageType,
        body: messageBody,
        status: 'received',
        metadata: {
          ...metadata,
          isFirstMessage,
        },
      });
      
      // 5. Check for automation triggers
      const triggerResults = await triggerMatchingService.checkMessageTrigger(
        user.id,
        contact.id,
        phoneNumberId,
        messageBody,
        isFirstMessage
      );
      
      console.log(`[Incoming] Found ${triggerResults.length} automations to execute`);
      
      // 6. Execute matched automations
      const executionPromises = triggerResults.map(result => 
        automationExecutionService.triggerAutomation(
          result.matchedAutomation.id,
          contact.id,
          user.id,
          {
            triggerType: result.triggerType,
            message: messageBody,
            isFirstMessage,
            matchedKeywords: result.matchedKeywords,
            metadata: {
              conversation_id: conversation.id,
              saved_message_id: savedMessage.id,
              whatsapp_message_id: whatsappMessageId,
            }
          }
        )
      );
      
      // Execute all automations in parallel
      const executionResults = await Promise.allSettled(executionPromises);
      
      executionResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          console.log(`[Incoming] ✅ Automation ${index + 1} executed successfully`);
        } else {
          console.error(`[Incoming] ❌ Automation ${index + 1} failed:`, result);
        }
      });
      
      // 7. Update contact's last contacted time
      await db.update(contacts)
        .set({
          lastContactedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(contacts.id, contact.id));
      
      return {
        success: true,
        message: savedMessage,
        contact,
        conversation,
        triggeredAutomations: triggerResults.length,
        executions: executionResults.map((r, i) => ({
          automation: triggerResults[i]?.matchedAutomation?.name || 'Unknown',
          success: r.status === 'fulfilled' && r.value.success,
        })),
      };
      
    } catch (error: any) {
      console.error('[Incoming] Error handling message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get or create conversation for a contact
   */
  async getOrCreateConversation(
    contactId: string, 
    userId: string, 
    whatsappPhoneNumberId: string
  ) {
    const db = getDb();
    
    const [existingConversation] = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.contactId, contactId),
        eq(conversations.whatsappPhoneNumberId, whatsappPhoneNumberId),
        eq(conversations.userId, userId)
      ))
      .limit(1);
    
    if (existingConversation) {
      return existingConversation;
    }
    
    const [newConversation] = await db.insert(conversations).values({
      id: uuidv4(),
      contactId,
      userId,
      whatsappPhoneNumberId,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();
    
    return newConversation!;
  }

  /**
   * Send a message via WhatsApp and save to database
   */
  async sendMessage(params: SendMessageParams) {
    const db = getDb();
    
    try {
      console.log('📤 Starting sendMessage with params:', {
        userId: params.userId,
        contactId: params.contactId,
        direction: params.direction,
        messageType: params.messageType,
        hasAttachments: !!params.attachments?.length,
        isInteractive: params.messageType === 'interactive',
        bodyPreview: params.body?.substring(0, 50),
      });

      // 1. Get user
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      
      if (!user) throw new Error('User not found');
      if (params.direction === 'outgoing' && (!user.whatsappPhoneNumberId || !user.whatsappAccessToken)) {
        throw new Error('WhatsApp not configured for user');
      }
      
      // 2. Get contact
      const [contact] = await db.select()
        .from(contacts)
        .where(eq(contacts.id, params.contactId))
        .limit(1);
      
      if (!contact) throw new Error('Contact not found');
      if (!contact.phone) throw new Error('Contact has no phone number');
      
      // 3. Get or create conversation
      let conversation;
      if (params.conversationId) {
        [conversation] = await db.select()
          .from(conversations)
          .where(eq(conversations.id, params.conversationId))
          .limit(1);
      }
      
      if (!conversation) {
        conversation = await this.getOrCreateConversation(
          contact.id,
          user.id,
          user.whatsappPhoneNumberId!
        );
      }

      console.log('✅ Got conversation:', conversation.id);

      // 4. Handle media attachments (only if not interactive message)
      let mediaAttachmentId: string | null = null;
      let mediaAttachmentData: any = null;
      
      if (params.attachments && params.attachments.length > 0 && params.messageType !== 'interactive') {
        const attachment = params.attachments[0];
        if (!attachment) {
          throw new Error('Invalid attachment data');
        }
        
        console.log('📎 Processing attachment:', {
          hasId: !!attachment.id,
          secureUrl: attachment.secureUrl?.substring(0, 50),
          mimeType: attachment.mimeType,
        });

        if (attachment.id) {
          // Use existing media attachment
          mediaAttachmentId = attachment.id;
          
          const [existingMedia] = await db.select()
            .from(mediaAttachments)
            .where(eq(mediaAttachments.id, attachment.id))
            .limit(1);
            
          if (!existingMedia) {
            throw new Error(`Media attachment with ID ${attachment.id} not found`);
          }
          
          mediaAttachmentData = existingMedia;
          
          // Update caption if needed
          if (params.body && params.body !== existingMedia.caption) {
            await db.update(mediaAttachments)
              .set({ 
                caption: params.body,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(mediaAttachments.id, attachment.id));
          }

          console.log('✅ Using existing media attachment:', mediaAttachmentId);
        } else {
          // Create new media attachment record
          const newMediaId = uuidv4();
          
          let publicId = attachment.providerId || '';
          if (!publicId && attachment.secureUrl) {
            const extracted = this.extractPublicIdFromCloudinaryUrl(attachment.secureUrl);
            publicId = extracted || '';
          }
          if (!publicId) {
            publicId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }

          const version = `v${Date.now()}`;
          
          let format = '';
          if (attachment.originalFilename) {
            format = attachment.originalFilename.split('.').pop() || '';
          } else if (attachment.filename) {
            format = attachment.filename.split('.').pop() || '';
          } else if (attachment.mimeType) {
            format = attachment.mimeType.split('/').pop() || '';
          }

          console.log('📝 Creating new media attachment:', {
            id: newMediaId,
            publicId,
            version,
            format,
          });

          // Create media attachment values based on your schema
          const mediaAttachmentValues: any = {
            id: newMediaId,
            uploadedByUserId: params.userId,
            secureUrl: attachment.secureUrl || attachment.url || '',
            thumbnailUrl: attachment.secureUrl || attachment.url || '',
            mimeType: attachment.mimeType || 'application/octet-stream',
            fileSize: attachment.fileSize || 0,
            width: attachment.width || null,
            height: attachment.height || null,
            duration: attachment.duration || null,
            format: format || '',
            resourceType: this.getResourceTypeFromMime(attachment.mimeType || 'application/octet-stream'),
            publicId: publicId,
            version: version,
            provider: attachment.provider || 'cloudinary',
            providerId: attachment.providerId || publicId,
            tags: ['message', params.direction],
            caption: params.body || attachment.caption || '',
            status: 'active',
            metadata: attachment.metadata || {},
            uploadedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Only add fields that exist in your schema
          if (attachment.originalFilename) {
            mediaAttachmentValues.originalFilename = attachment.originalFilename;
          }

          const [newMediaAttachment] = await db.insert(mediaAttachments).values(mediaAttachmentValues).returning();
          
          mediaAttachmentId = newMediaAttachment!.id;
          mediaAttachmentData = newMediaAttachment;

          console.log('✅ Created new media attachment:', mediaAttachmentId);
        }
      }
      
      // 5. Send via WhatsApp API if outgoing
      let whatsappResponse: any = null;
      let whatsappMessageId: string | undefined = undefined;
      
      if (params.direction === 'outgoing') {
        try {
          // Handle interactive messages (both lists and buttons)
          if (params.messageType === 'interactive') {
            console.log('🎮 Sending WhatsApp interactive message');
            
            // Check for list data (list messages)
            if (params.metadata?.listData) {
              console.log('📋 Interactive type: LIST');
              
              whatsappResponse = await WhatsAppService.sendInteractiveMessage(
                user.whatsappPhoneNumberId!,
                contact.phone!,
                params.metadata.listData,
                user.whatsappAccessToken!
              );
              
              console.log('📋 WhatsApp list message response:', {
                success: !!whatsappResponse?.messages?.[0]?.id,
                responseId: whatsappResponse?.messages?.[0]?.id,
              });
            }
            // Check for interactive data (button messages)
            else if (params.metadata?.interactiveData) {
              console.log('🔘 Interactive type: BUTTONS/QUICK_REPLIES');
              
              whatsappResponse = await WhatsAppService.sendInteractiveMessage(
                user.whatsappPhoneNumberId!,
                contact.phone!,
                params.metadata.interactiveData,
                user.whatsappAccessToken!
              );
              
              console.log('🔘 WhatsApp button message response:', {
                success: !!whatsappResponse?.messages?.[0]?.id,
                responseId: whatsappResponse?.messages?.[0]?.id,
              });
            } else {
              console.error('❌ Interactive message missing data (listData or interactiveData)');
              throw new Error('Interactive message missing data');
            }
            
          } else if (mediaAttachmentId && mediaAttachmentData) {
            // Send media message
            console.log('📤 Sending media message via WhatsApp');
            const mediaType = this.getMediaTypeFromMime(mediaAttachmentData.mimeType);
            
            whatsappResponse = await WhatsAppService.sendMediaMessage(
              user.whatsappPhoneNumberId!,
              contact.phone!,
              mediaAttachmentData.secureUrl,
              mediaType,
              params.body || mediaAttachmentData.caption,
              mediaAttachmentData.originalFilename,
              user.whatsappAccessToken!
            );
          } else {
            // Send text message
            console.log('📤 Sending text message via WhatsApp');
            whatsappResponse = await WhatsAppService.sendTextMessage(
              user.whatsappPhoneNumberId!,
              contact.phone!,
              params.body,
              user.whatsappAccessToken!
            );
          }
          
          if (whatsappResponse?.messages?.[0]?.id) {
            whatsappMessageId = whatsappResponse.messages[0].id;
            console.log('✅ WhatsApp message sent, ID:', whatsappMessageId);
          }
          
        } catch (error: any) {
          console.error('❌ Error sending WhatsApp message:', error);
          console.error('❌ Error details:', error.response?.data || error.message);
          // We still save the message but with failed status
        }
      }
      
      // 6. Determine message type with proper type handling
      const messageType = (() => {
        // Use explicit message type if provided
        if (params.messageType !== undefined) {
          return params.messageType;
        }
        
        // Default to text or media type based on attachments
        if (params.attachments && params.attachments.length > 0) {
          const attachment = params.attachments[0];
          if (!attachment) return 'text';
          
          const mimeType = attachment.mimeType || '';
          if (mimeType.startsWith('image/')) return 'image';
          if (mimeType.startsWith('video/')) return 'video';
          if (mimeType.startsWith('audio/')) return 'audio';
          return 'document';
        }
        
        return 'text';
      })();

      // 7. Determine message status
      const messageStatus = this.getMessageStatus(
        params.direction, 
        whatsappResponse, 
        params.metadata?.whatsappMessageId
      );

      console.log('💾 Saving message to database:', {
        conversationId: conversation.id,
        messageType,
        status: messageStatus,
        hasMedia: !!mediaAttachmentId,
        isInteractive: params.messageType === 'interactive',
        hasListData: !!params.metadata?.listData,
      });
      
      // 8. Save message to database
      const messageMetadata: any = {
        ...params.metadata,
        whatsappResponse: whatsappResponse,
      };
      
      // Add media attachment data if exists
      if (mediaAttachmentId) {
        messageMetadata.mediaAttachmentId = mediaAttachmentId;
        messageMetadata.secureUrl = mediaAttachmentData?.secureUrl;
        messageMetadata.originalFilename = mediaAttachmentData?.originalFilename || null;
        messageMetadata.mimeType = mediaAttachmentData?.mimeType;
        messageMetadata.fileSize = mediaAttachmentData?.fileSize;
        messageMetadata.width = mediaAttachmentData?.width;
        messageMetadata.height = mediaAttachmentData?.height;
        messageMetadata.duration = mediaAttachmentData?.duration;
      }
      
      // Add interactive message metadata
      if (params.messageType === 'interactive') {
        // For list messages
        if (params.metadata?.listData) {
          messageMetadata.listData = params.metadata.listData;
          messageMetadata.isInteractiveList = true;
          
          if (params.metadata.rowIds) {
            messageMetadata.rowIds = params.metadata.rowIds;
          }
          
          console.log('📋 Saving interactive list metadata:', {
            hasListData: true,
            rowCount: params.metadata.rowIds?.length || 0,
          });
        }
        // For button/quick reply messages
        else if (params.metadata?.interactiveData) {
          messageMetadata.interactiveData = params.metadata.interactiveData;
          messageMetadata.isInteractiveMessage = true;
          
          if (params.metadata.actionIds) {
            messageMetadata.actions = params.metadata.actionIds;
          }
          
          console.log('🔘 Saving interactive button metadata:', {
            hasInteractiveData: true,
            actionCount: params.metadata.actionIds?.length || 0,
          });
        }
      }
      
      // Prepare message values - only include fields that exist in schema
      const messageValues: any = {
        id: uuidv4(),
        conversationId: conversation.id,
        contactId: contact.id,
        direction: params.direction,
        messageType: messageType,
        body: params.body || '',
        status: messageStatus,
        metadata: messageMetadata,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Add optional fields if they exist
      if (whatsappMessageId || params.metadata?.whatsappMessageId) {
        messageValues.whatsappMessageId = whatsappMessageId || params.metadata?.whatsappMessageId;
      }
      
      if (mediaAttachmentId) {
        messageValues.mediaAttachmentId = mediaAttachmentId;
      }

      const [savedMessage] = await db.insert(messages).values(messageValues).returning();

      console.log('✅ Message saved:', savedMessage!.id);
      
      // 9. Update media attachment to link with message (if exists)
      if (mediaAttachmentId) {
        await db.update(mediaAttachments)
          .set({ 
            messageId: savedMessage!.id,
            updatedAt: new Date().toISOString() 
          })
          .where(eq(mediaAttachments.id, mediaAttachmentId));
        console.log('✅ Linked media attachment to message');
      }
      
      // 10. Update conversation
      let lastMessage = params.body?.substring(0, 100);
      
      if (!lastMessage) {
        if (params.messageType === 'interactive') {
          lastMessage = '[Interactive List]';
        } else if (mediaAttachmentId) {
          lastMessage = `[${messageType}]`;
        } else {
          lastMessage = 'Message';
        }
      }
      
      const updateData: any = {
        lastMessage,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (params.direction === 'incoming') {
        updateData.unreadCount = (conversation.unreadCount || 0) + 1;
      }
      
      await db.update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversation.id));

      console.log('✅ Conversation updated');
      
      // 11. Return complete response
      return {
        success: true,
        message: savedMessage,
        conversation: {
          ...conversation,
          lastMessage,
          lastMessageAt: new Date().toISOString(),
          unreadCount: params.direction === 'incoming' ? (conversation.unreadCount || 0) + 1 : conversation.unreadCount,
        },
        mediaAttachmentId,
        whatsappResponse,
      };
      
    } catch (error: any) {
      console.error('❌ Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Save a message to database (without sending)
   */
  async saveMessage(params: SaveMessageParams) {
    const db = getDb();
    
    // Prepare message values - only include fields that exist in schema
    const messageValues: any = {
      id: uuidv4(),
      conversationId: params.conversationId,
      contactId: params.contactId,
      direction: params.direction,
      messageType: params.messageType,
      body: params.body,
      status: params.status,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Add optional fields if they exist
    if (params.whatsappMessageId) {
      messageValues.whatsappMessageId = params.whatsappMessageId;
    }

    if (params.metadata) {
      messageValues.metadata = params.metadata;
    }
    
    const [savedMessage] = await db.insert(messages).values(messageValues).returning();
    
    return savedMessage!;
  }

  /**
   * Helper: Extract public_id from Cloudinary URL
   */
private extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    if (!url) return null;
    
    // Common Cloudinary URL patterns:
    // https://res.cloudinary.com/cloud_name/image/upload/v1234567890/path/to/file.jpg
    // https://res.cloudinary.com/cloud_name/image/upload/path/to/file.jpg
    
    // Remove the base URL
    const cloudinaryRegex = /res\.cloudinary\.com\/[^\/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^\.]+)?$/;
    const match = url.match(cloudinaryRegex);
    
    if (match && match[2] !== undefined) {
      return match[2];
    }
    
    // Alternative pattern for shorter URLs
    const altRegex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^\.]+)?$/;
    const altMatch = url.match(altRegex);
    
    if (altMatch && altMatch[1] !== undefined) {
      return altMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

  /**
   * Helper: Get resource type from mime type for Cloudinary
   */
  private getResourceTypeFromMime(mimeType: string): 'image' | 'video' | 'raw' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'video';
    return 'raw';
  }

  /**
   * Helper: Get media type from mime type for WhatsApp
   */
  private getMediaTypeFromMime(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Helper: Determine message type
   */
  private getMessageType(params: {
    attachments?: SendMessageParams['attachments'];
    messageType?: string;
  } = {}): string {
    // Use explicit message type if provided
    if (params.messageType !== undefined) {
      return params.messageType;
    }
    
    // Default to text or media type based on attachments
    if (params.attachments && params.attachments.length > 0) {
      const attachment = params.attachments[0];
      if (!attachment) return 'text';
      
      const mimeType = attachment.mimeType || '';
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      return 'document';
    }
    
    return 'text';
  }

  /**
   * Helper: Determine message status
   */
  private getMessageStatus(
    direction: 'incoming' | 'outgoing', 
    whatsappResponse: any,
    existingWhatsappMessageId?: string
  ): string {
    if (direction === 'incoming') return 'received';
    if (existingWhatsappMessageId) return 'sent';
    if (whatsappResponse?.messages?.[0]?.id) return 'sent';
    if (direction === 'outgoing' && !whatsappResponse) return 'failed';
    return 'sent';
  }

  /**
   * Save media attachment separately
   */
  async saveMediaAttachment(attachment: {
    originalFilename?: string;
    filename?: string;
    secureUrl: string;
    thumbnailUrl?: string;
    mimeType: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    provider?: string;
    providerId?: string;
    metadata?: Record<string, any>;
  }, userId: string): Promise<string> {
    const db = getDb();
    
    // Extract or generate public_id
    let publicId = attachment.providerId || '';
    if (!publicId && attachment.secureUrl) {
      const extracted = this.extractPublicIdFromCloudinaryUrl(attachment.secureUrl);
      publicId = extracted || '';
    }
    if (!publicId) {
      publicId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Get format
    let format = '';
    if (attachment.originalFilename) {
      format = attachment.originalFilename.split('.').pop() || '';
    } else if (attachment.filename) {
      format = attachment.filename.split('.').pop() || '';
    } else if (attachment.mimeType) {
      format = attachment.mimeType.split('/').pop() || '';
    }
    
    const mediaAttachmentValues: any = {
      id: uuidv4(),
      uploadedByUserId: userId,
      secureUrl: attachment.secureUrl,
      thumbnailUrl: attachment.thumbnailUrl || attachment.secureUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize || 0,
      width: attachment.width || null,
      height: attachment.height || null,
      duration: attachment.duration || null,
      format: format || '',
      resourceType: this.getResourceTypeFromMime(attachment.mimeType),
      publicId: publicId,
      version: `v${Date.now()}`,
      provider: attachment.provider || 'cloudinary',
      providerId: attachment.providerId || publicId,
      tags: ['uploaded'],
      caption: '',
      status: 'active',
      metadata: attachment.metadata || {},
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Only add originalFilename if the schema has it
    if (attachment.originalFilename) {
      mediaAttachmentValues.originalFilename = attachment.originalFilename;
    }

    const [savedAttachment] = await db.insert(mediaAttachments).values(mediaAttachmentValues).returning();
    
    return savedAttachment!.id;
  }

  /**
   * Get media attachment by ID
   */
  async getMediaAttachment(id: string): Promise<any> {
    const db = getDb();
    
    const [media] = await db.select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.id, id))
      .limit(1);
    
    return media;
  }
}

export const messageService = new MessageService();