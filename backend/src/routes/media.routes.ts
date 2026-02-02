// backend/src/routes/media.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { CloudinaryService } from '../services/cloudinary.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { users, contacts, conversations, messages, mediaAttachments } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),
  },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
 * Upload media to Cloudinary and send via WhatsApp
 */
router.post('/send', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { phoneNumber, caption } = req.body;
    const file = req.file;

    if (!file || !phoneNumber) {
      return res.status(400).json({ 
        success: false,
        error: 'File and phone number are required' 
      });
    }

    const db = getDb();
    
    // Get user
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }
    
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const user = userResult[0];
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

    // Upload to Cloudinary
    const cloudinaryResult = await CloudinaryService.uploadFile({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }, {
      folder: `whatsapp_media/user_${user.id}`,
      tags: ['whatsapp', `user_${user.id}`],
      context: {
        uploaded_by: user.email,
        original_filename: file.originalname,
      },
    });

    if (!cloudinaryResult.success) {
      return res.status(500).json({ 
        success: false,
        error: cloudinaryResult.error || 'Failed to upload to Cloudinary' 
      });
    }

    if (!cloudinaryResult.publicId || !cloudinaryResult.secureUrl) {
      return res.status(500).json({ 
        success: false,
        error: 'Cloudinary upload missing required data' 
      });
    }

    // Determine WhatsApp media type
    let whatsappMediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (file.mimetype.startsWith('image/')) {
      whatsappMediaType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      whatsappMediaType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      whatsappMediaType = 'audio';
    }

    // Send via WhatsApp
    const whatsappResult = await WhatsAppService.sendMediaMessage(
      user.whatsappPhoneNumberId!,
      phoneNumber,
      cloudinaryResult.secureUrl,
      whatsappMediaType,
      caption,
      file.originalname,
      user.whatsappAccessToken!
    );

    // Find or create contact
    const contact = await findOrCreateContact(phoneNumber, user.id, user.whatsappPhoneNumberId!);
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      contact.id,
      user.whatsappPhoneNumberId!,
      user.id
    );

    // Save media attachment
    const mediaAttachmentData = {
      publicId: cloudinaryResult.publicId,
      secureUrl: cloudinaryResult.secureUrl,
      uploadedByUserId: user.id,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      width: cloudinaryResult.width || null,
      height: cloudinaryResult.height || null,
      duration: cloudinaryResult.duration || null,
      format: cloudinaryResult.format || null,
      resourceType: cloudinaryResult.resourceType || 'image',
      caption: caption || null,
      tags: ['whatsapp', 'outgoing', `type_${whatsappMediaType}`],
      status: 'active' as const,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageId: null,
      version: null,
      thumbnailUrl: null,
    };

    const mediaAttachmentResult = await db.insert(mediaAttachments).values(mediaAttachmentData).returning();
    if (!mediaAttachmentResult.length || !mediaAttachmentResult[0]) {
      throw new Error('Failed to create media attachment');
    }
    const mediaAttachment = mediaAttachmentResult[0];

    // Save message
    const messageData = {
      conversationId: conversation.id,
      contactId: contact.id,
      whatsappMessageId: whatsappResult.messages?.[0]?.id || `temp_${Date.now()}`,
      direction: 'outgoing' as const,
      messageType: whatsappMediaType,
      body: caption || file.originalname,
      status: 'sent' as const,
      timestamp: new Date().toISOString(),
      mediaAttachmentId: mediaAttachment.id,
      metadata: {
        cloudinaryUrl: cloudinaryResult.secureUrl,
        originalFilename: file.originalname,
        fileSize: file.size,
        mediaType: whatsappMediaType,
      },
      createdAt: new Date().toISOString(),
      id: undefined as any,
    };

    const savedMessageResult = await db.insert(messages).values(messageData).returning();
    if (!savedMessageResult.length || !savedMessageResult[0]) {
      throw new Error('Failed to create message');
    }
    const savedMessage = savedMessageResult[0];

    // Update conversation
    await db.update(conversations)
      .set({
        lastMessage: caption || file.originalname,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(conversations.id, conversation.id));

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
    console.error('❌ Media upload and send error:', error);
    res.status(500).json({ 
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to send media'
    });
  }
});

/**
 * Get Cloudinary upload signature for frontend direct uploads
 */
router.get('/upload-signature', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }
    
    const db = getDb();
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const user = userResult[0];
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Create upload parameters
    const timestamp = Math.round(Date.now() / 1000);
    const params = {
      timestamp,
      folder: `whatsapp_media/user_${user.id}`,
      tags: `whatsapp,user_${user.id}`,
    };
    
    // Generate signature
    const signature = CloudinaryService.generateUploadSignature(params);
    
    res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
        signature,
        timestamp,
        folder: params.folder,
        tags: params.tags,
      },
    });
    
  } catch (error: any) {
    console.error('❌ Error generating upload signature:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate upload signature' 
    });
  }
});

/**
 * Upload multiple files
 */
router.post('/upload-multiple', authenticate, upload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const folder = req.body.folder;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files provided' 
      });
    }

    console.log(`📤 Processing ${files.length} file(s) for upload`);

    const db = getDb();
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }
    
    const uploadPromises = files.map(async (file) => {
      try {
        console.log(`📄 Processing file: ${file.originalname} (${file.size} bytes)`);
        
        const cloudinaryResult = await CloudinaryService.uploadFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }, {
          folder: folder || 'quick_replies',
          tags: ['quick_reply', `user_${userId}`],
          context: {
            uploaded_by_user: userId,
            original_filename: file.originalname,
          },
        });

        if (!cloudinaryResult.success) {
          console.error(`❌ Cloudinary upload failed for ${file.originalname}:`, cloudinaryResult.error);
          return {
            success: false,
            originalname: file.originalname,
            error: cloudinaryResult.error || 'Cloudinary upload failed',
          };
        }

        if (!cloudinaryResult.publicId || !cloudinaryResult.secureUrl) {
          return {
            success: false,
            originalname: file.originalname,
            error: 'Cloudinary upload missing required data',
          };
        }

        // Save to mediaAttachments table
        const mediaAttachmentData = {
          publicId: cloudinaryResult.publicId,
          secureUrl: cloudinaryResult.secureUrl,
          uploadedByUserId: userId,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          width: cloudinaryResult.width || null,
          height: cloudinaryResult.height || null,
          duration: cloudinaryResult.duration || null,
          format: cloudinaryResult.format || null,
          resourceType: cloudinaryResult.resourceType || 'image',
          caption: file.originalname,
          tags: ['quick_reply', 'uploaded'],
          status: 'active' as const,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageId: null,
          version: null,
          thumbnailUrl: cloudinaryResult.secureUrl,
        };

        const mediaAttachmentResult = await db.insert(mediaAttachments).values(mediaAttachmentData).returning();
        if (!mediaAttachmentResult.length || !mediaAttachmentResult[0]) {
          throw new Error('Failed to create media attachment');
        }
        const mediaAttachment = mediaAttachmentResult[0];

        console.log(`✅ Saved media attachment to DB with ID: ${mediaAttachment.id}`);

        return {
          success: true,
          id: mediaAttachment.id,
          publicId: cloudinaryResult.publicId,
          secureUrl: cloudinaryResult.secureUrl,
          originalname: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        };
      } catch (error: any) {
        console.error(`❌ Failed to upload ${file.originalname}:`, error);
        return {
          success: false,
          originalname: file.originalname,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(uploadPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`📊 Upload results: ${successful.length} successful, ${failed.length} failed`);

    res.json({
      success: true,
      data: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        uploads: results,
      },
    });

  } catch (error: any) {
    console.error('❌ Multiple upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Get user's media attachments
 */
router.get('/attachments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }

    const db = getDb();
    
    // Build where conditions
    const conditions = [eq(mediaAttachments.uploadedByUserId, userId)];
    if (type) {
      conditions.push(eq(mediaAttachments.resourceType, type as string));
    }
    
    // Get attachments
    const attachments = await db.select()
      .from(mediaAttachments)
      .where(and(...conditions))
      .orderBy(mediaAttachments.createdAt)
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(mediaAttachments)
      .where(and(...conditions));

    const total = countResult[0]?.count ? Number(countResult[0].count) : 0;

    res.json({
      success: true,
      data: {
        attachments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attachments' 
    });
  }
});

/**
 * Delete media attachment
 */
router.delete('/attachments/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Attachment ID is required' 
      });
    }
    
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }

    const db = getDb();
    
    // Get the attachment first
    const attachmentResult = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          eq(mediaAttachments.id, id),
          eq(mediaAttachments.uploadedByUserId, userId)
        )
      )
      .limit(1);

    if (attachmentResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Attachment not found' 
      });
    }

    const attachment = attachmentResult[0];
    if (!attachment) {
      return res.status(404).json({ 
        success: false,
        error: 'Attachment not found' 
      });
    }

    if (!attachment.publicId || !attachment.resourceType) {
      return res.status(500).json({ 
        success: false,
        error: 'Attachment data incomplete' 
      });
    }

    // Delete from Cloudinary
    const deleteResult = await CloudinaryService.deleteFile(
      attachment.publicId,
      attachment.resourceType as any
    );

    if (!deleteResult.success) {
      console.warn(`⚠️ Could not delete from Cloudinary: ${deleteResult.error}`);
    }

    // Delete from database
    await db.delete(mediaAttachments)
      .where(eq(mediaAttachments.id, id));

    res.json({
      success: true,
      message: 'Attachment deleted successfully',
      data: {
        cloudinaryDelete: deleteResult.success,
      },
    });

  } catch (error: any) {
    console.error('❌ Error deleting attachment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete attachment' 
    });
  }
});

// Helper functions
async function findOrCreateContact(
  phoneNumber: string,
  userId: string,
  whatsappPhoneNumberId: string
) {
  const db = getDb();
  
  let formattedPhone = phoneNumber.replace(/\D/g, '');
  
  let contactResult = await db.select()
    .from(contacts)
    .where(
      and(
        eq(contacts.phone, formattedPhone),
        eq(contacts.userId, userId)
      )
    )
    .limit(1);
  
  if (contactResult.length > 0) {
    const contact = contactResult[0];
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }
  
  // Create contact data with proper type casting
  const contactData = {
    phone: formattedPhone,
    name: `Contact ${formattedPhone}` as string | null,
    userId: userId,
    whatsappPhoneNumberId: whatsappPhoneNumberId,
    source: 'whatsapp' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: undefined as any,
    email: '' as string | null,
    note: '' as string | null,
    isActive: true,
    optIn: true,
    address: '' as string | null,
    city: '' as string | null,
    state: '' as string | null,
    country: '' as string | null,
    postalCode: '' as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
    lastContactedAt: null as string | null,
    customFields: {} as Record<string, any>,
    tagIds: [] as string[],
  };
  
  const newContactResult = await db.insert(contacts).values(contactData).returning();
  if (!newContactResult.length || !newContactResult[0]) {
    throw new Error('Failed to create contact');
  }
  const newContact = newContactResult[0];
  
  return newContact;
}

async function findOrCreateConversation(
  contactId: string,
  whatsappPhoneNumberId: string,
  userId: string
) {
  const db = getDb();
  
  let conversationResult = await db.select()
    .from(conversations)
    .where(
      and(
        eq(conversations.contactId, contactId),
        eq(conversations.whatsappPhoneNumberId, whatsappPhoneNumberId)
      )
    )
    .limit(1);
  
  if (conversationResult.length > 0) {
    const conversation = conversationResult[0];
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }
  
  const conversationData = {
    contactId: contactId,
    userId: userId,
    whatsappPhoneNumberId: whatsappPhoneNumberId,
    lastMessage: 'New conversation',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    status: 'active' as const, // FIXED: Added "as const" for literal type
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: undefined as any,
    assignedToUserId: null,
    tagIds: [],
  };
  
  const newConversationResult = await db.insert(conversations).values(conversationData).returning();
  if (!newConversationResult.length || !newConversationResult[0]) {
    throw new Error('Failed to create conversation');
  }
  const newConversation = newConversationResult[0];
  
  return newConversation;
}

export default router;