// backend/src/routes/media.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { CloudinaryService } from '../services/cloudinary.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { users, contacts, conversations, messages, mediaAttachments } from '../db/schema';
import { eq, and } from 'drizzle-orm';

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
    console.log(`📁 File: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

    // 2. Upload file to Cloudinary
    console.log('☁️ Uploading to Cloudinary...');
    
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

    console.log(`✅ Cloudinary upload successful:`);
    console.log(`   URL: ${cloudinaryResult.secureUrl}`);
    console.log(`   Public ID: ${cloudinaryResult.publicId}`);
    console.log(`   Size: ${(cloudinaryResult.fileSize / 1024).toFixed(2)} KB`);

    // 3. Determine WhatsApp media type from file type
    let whatsappMediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    
    if (file.mimetype.startsWith('image/')) {
      whatsappMediaType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      whatsappMediaType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      whatsappMediaType = 'audio';
    }

    // 4. Send media message via WhatsApp
    console.log(`📤 Sending via WhatsApp (${whatsappMediaType}) to ${phoneNumber}...`);
    
    const whatsappResult = await WhatsAppService.sendMediaMessage(
      user.whatsappPhoneNumberId,
      phoneNumber,
      cloudinaryResult.secureUrl,
      whatsappMediaType,
      caption,
      file.originalname,
      user.whatsappAccessToken
    );

    console.log(`✅ WhatsApp message sent successfully`);
    console.log(`   Message ID: ${whatsappResult.messages?.[0]?.id}`);

    // 5. Find or create contact
    const contact = await findOrCreateContact(phoneNumber, user.id, user.whatsappPhoneNumberId);
    
    // 6. Find or create conversation
    const conversation = await findOrCreateConversation(
      contact.id,
      user.whatsappPhoneNumberId,
      user.id
    );

    // 7. Save media attachment record
    const [mediaAttachment] = await db.insert(mediaAttachments).values({
      publicId: cloudinaryResult.publicId,
      cloudinaryUrl: cloudinaryResult.url,
      secureUrl: cloudinaryResult.secureUrl,
      filename: file.originalname,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height,
      duration: cloudinaryResult.duration,
      format: cloudinaryResult.format,
      assetType: cloudinaryResult.resourceType,
      resourceType: cloudinaryResult.resourceType,
      caption: caption,
      tags: ['whatsapp', 'outgoing', `type_${whatsappMediaType}`],
      transformation: {
        thumbnail: CloudinaryService.generateThumbnailUrl(cloudinaryResult.publicId),
        responsive: CloudinaryService.generateResponsiveThumbnails(cloudinaryResult.publicId),
      },
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log(`💾 Media attachment saved: ${mediaAttachment.id}`);

    // 8. Save message record
    const [savedMessage] = await db.insert(messages).values({
      conversationId: conversation.id,
      contactId: contact.id,
      whatsappMessageId: whatsappResult.messages?.[0]?.id || `temp_${Date.now()}`,
      direction: 'outgoing',
      messageType: whatsappMediaType,
      body: caption || file.originalname,
      status: 'sent',
      timestamp: new Date(),
      mediaAttachmentId: mediaAttachment.id,
      metadata: {
        cloudinaryUrl: cloudinaryResult.secureUrl,
        originalFilename: file.originalname,
        fileSize: file.size,
        mediaType: whatsappMediaType,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log(`💾 Message saved: ${savedMessage.id}`);

    // 9. Update conversation
    await db.update(conversations)
      .set({
        lastMessage: caption || file.originalname,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    console.log(`✅ All records saved successfully`);

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
    const { folder } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files provided' 
      });
    }

    console.log(`📤 Processing ${files.length} file(s) for upload`);

    const uploadPromises = files.map(file => 
      CloudinaryService.uploadFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }, {
        folder: folder || 'whatsapp_media',
      })
    );

    const results = await Promise.all(uploadPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      data: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        uploads: results.map((result, index) => ({
          originalname: files[index].originalname,
          success: result.success,
          url: result.secureUrl,
          publicId: result.publicId,
          error: result.error,
        })),
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

    const db = getDb();
    
    let query = db.select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.userId, req.user!.userId))
      .orderBy(mediaAttachments.createdAt)
      .limit(Number(limit))
      .offset(offset);

    if (type) {
      query = query.where(eq(mediaAttachments.resourceType, type as string));
    }

    const attachments = await query;

    // Get total count
    const countQuery = db.select({ count: sql`count(*)` })
      .from(mediaAttachments)
      .where(eq(mediaAttachments.userId, req.user!.userId));
    
    if (type) {
      countQuery.where(eq(mediaAttachments.resourceType, type as string));
    }

    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count || 0);

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

    const db = getDb();
    
    // Get the attachment first
    const attachmentResult = await db.select()
      .from(mediaAttachments)
      .where(
        and(
          eq(mediaAttachments.id, id),
          eq(mediaAttachments.userId, req.user!.userId)
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
    return contactResult[0];
  }
  
  const [newContact] = await db.insert(contacts).values({
    phone: formattedPhone,
    name: `Contact ${formattedPhone}`,
    userId: userId,
    whatsappPhoneNumberId: whatsappPhoneNumberId,
    source: 'whatsapp' as any,
    status: 'active' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  
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
    return conversationResult[0];
  }
  
  const [newConversation] = await db.insert(conversations).values({
    contactId: contactId,
    userId: userId,
    whatsappPhoneNumberId: whatsappPhoneNumberId,
    lastMessage: 'New conversation',
    lastMessageAt: new Date(),
    unreadCount: 0,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  
  return newConversation;
}

export default router;