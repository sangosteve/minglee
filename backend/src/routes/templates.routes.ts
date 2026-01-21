// backend/src/routes/templates.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { templatesService } from '../services/templates.service';
import { z } from 'zod';
import { getDb } from '../db/client';
import { eq, sql, and, like, desc, asc } from 'drizzle-orm';
import { messageTemplates, users, contacts } from '../db/schema';
import { MetaTemplateService } from '../services/meta-template.service';
import { messageService } from '../services/message/message.service';
import { 
  WhatsAppTemplateBuilder, 
  whatsappTemplateService,
  WhatsAppTemplateError,
  ComponentType,
  ParameterType
} from '../services/whatsapp-template.service';
import { renderTemplateWithParameters, validateTemplateParameters } from '../utils/whatsapp-utils';
import { validateTemplateMedia } from '../utils/media-utils';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().optional(),
  language: z.string().default('en'),
  components: z.array(z.object({
    type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
    format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
    text: z.string().optional(),
    example: z.any().optional(),
    buttons: z.array(z.object({
      type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
      text: z.string(),
      url: z.string().optional(),
      phone_number: z.string().optional(),
    })).optional(),
  })),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']),
    required: z.boolean().default(false),
    example: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  status: z.enum(['pending', 'approved', 'rejected', 'disabled']).optional(),
});

// GET /api/templates - Get all templates with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { 
      search, 
      category, 
      status, 
      language,
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    const userId = req.user!.userId;
    
    const result = await templatesService.getTemplates(userId, {
      search: search as string,
      category: category as string,
      status: status as string,
      language: language as string,
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/:id - Get template by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await templatesService.getTemplate(userId, templateId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates - Create new template
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Validate request body
    const validatedData = createTemplateSchema.parse(req.body);
    
    const result = await templatesService.createTemplate(userId, validatedData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    console.error('Error creating template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    // Validate request body
    const validatedData = updateTemplateSchema.parse(req.body);
    
    const result = await templatesService.updateTemplate(userId, templateId, validatedData);
    
    if (!result.success) {
      return res.status(result.error === 'Template not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    console.error('Error updating template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await templatesService.deleteTemplate(userId, templateId);
    
    if (!result.success) {
      return res.status(result.error === 'Template not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/sync/whatsapp - Sync templates from WhatsApp
router.post('/sync/whatsapp', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    console.log('🔄 Syncing templates for user:', userId);
    
    const result = await templatesService.syncWhatsAppTemplates(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error syncing WhatsApp templates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync WhatsApp templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// UPDATED: Send Template Message Endpoint (FIXED)
// ============================================================================

// Replace your entire /send endpoint with this DEBUGGED version
router.post('/:id/send', authenticate, async (req: AuthRequest, res) => {
  console.log('🚀 DEBUG - Starting template send process with media handling');
  
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    const { contactId, parameters, media: mediaFromRequest } = req.body;
    
    console.log('📥 Received request:', { 
      templateId, 
      userId, 
      contactId, 
      hasParameters: !!parameters,
      hasMedia: !!mediaFromRequest
    });

    const db = getDb();
    
    // 1. Get the template
    console.log('🔍 Step 1: Getting template from database...');
    const [template] = await db.select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);

    if (!template) {
      console.error('❌ Template not found');
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    console.log('✅ Template found:', {
      name: template.name,
      language: template.language,
      componentsCount: template.components?.length || 0
    });

    // 2. Check template media requirements
    const headerComponent = (template.components || []).find((c: any) => c.type === 'HEADER');
    const hasMediaHeader = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format || '');
    
    console.log('📊 Template Media Analysis:', {
      hasHeader: !!headerComponent,
      headerFormat: headerComponent?.format,
      hasMediaHeader: hasMediaHeader,
      requiresMedia: hasMediaHeader
    });

    // 3. Handle media for templates with media headers
    let mediaData = parameters?.media || mediaFromRequest;
    
    if (hasMediaHeader && !mediaData?.url) {
      console.log('🔍 Looking for recently uploaded media...');
      
      // Try to get most recent media uploaded for quick replies
      const recentMedia = await db.select()
        .from(mediaAttachments)
        .where(
          and(
            eq(mediaAttachments.uploadedByUserId, userId),
            sql`${mediaAttachments.tags} && array['quick_reply']::text[]`
          )
        )
        .orderBy(desc(mediaAttachments.uploadedAt))
        .limit(1);
      
      if (recentMedia.length > 0) {
        const recentMediaItem = recentMedia[0];
        console.log(`✅ Found recent media: ${recentMediaItem.originalFilename}`);
        
        mediaData = {
          url: recentMediaItem.secureUrl,
          type: recentMediaItem.resourceType,
          caption: recentMediaItem.caption || recentMediaItem.originalFilename,
          filename: recentMediaItem.originalFilename,
        };
        
        // Update parameters with media
        if (!parameters) {
          parameters = {};
        }
        parameters.media = mediaData;
      } else {
        console.error('❌ Template requires media but none provided or found');
        return res.status(400).json({
          success: false,
          error: `Template requires ${headerComponent.format?.toLowerCase()} media file`,
          details: {
            headerFormat: headerComponent.format,
            suggestion: 'Upload a file first using the media uploader, or include media URL in parameters'
          }
        });
      }
    }

    // 4. Merge media data into parameters
    const finalParameters = {
      ...parameters,
      ...(mediaData ? { media: mediaData } : {})
    };

    console.log('📦 Final parameters for sending:', {
      hasVariables: !!finalParameters?.variables,
      variableCount: finalParameters?.variables ? Object.keys(finalParameters.variables).length : 0,
      hasMedia: !!finalParameters?.media,
      mediaType: finalParameters?.media?.type
    });

    // 5. Get the contact
    console.log('🔍 Step 2: Getting contact from database...');
    const [contact] = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);

    if (!contact) {
      console.error('❌ Contact not found');
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    if (!contact.phone) {
      console.error('❌ Contact has no phone number');
      return res.status(400).json({
        success: false,
        error: 'Contact does not have a phone number'
      });
    }

    console.log('✅ Contact found:', { phone: contact.phone });

    // 6. Get user credentials
    console.log('🔍 Step 3: Getting user WhatsApp credentials...');
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.whatsappPhoneNumberId || !user?.whatsappAccessToken) {
      console.error('❌ WhatsApp not configured:', {
        hasPhoneNumberId: !!user?.whatsappPhoneNumberId,
        hasAccessToken: !!user?.whatsappAccessToken
      });
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured for user'
      });
    }

    console.log('✅ WhatsApp credentials found:', {
      phoneNumberId: user.whatsappPhoneNumberId,
      tokenPreview: user.whatsappAccessToken?.substring(0, 10) + '...'
    });

    // 7. Validate parameters (including media)
    console.log('🔍 Step 4: Validating parameters and media...');
    const validationErrors = validateTemplateParameters(template, finalParameters);
    
    // Additional media validation
    if (hasMediaHeader && finalParameters?.media) {
      const mediaErrors = validateTemplateMedia(template.components || [], finalParameters.media);
      validationErrors.push(...mediaErrors);
    }
    
    if (validationErrors.length > 0) {
      console.error('❌ Validation failed:', validationErrors);
      return res.status(400).json({
        success: false,
        error: 'Template validation failed',
        details: validationErrors
      });
    }

    console.log('✅ All validations passed');

    // 8. Build WhatsApp message
    console.log('🔍 Step 5: Building WhatsApp message...');
const whatsappComponents = whatsappTemplateService.convertComponentsToWhatsAppFormat(
  template.components || [],
  finalParameters || {}
);

    console.log(`✅ Built ${whatsappComponents.length} WhatsApp components`);

const builder = new WhatsAppTemplateBuilder()
  .setRecipient(contact.phone!)
  .setTemplate(template.name, template.language);

    const builtMessage = builder.build();
   if (!builtMessage.template.components) {
  builtMessage.template.components = [];
}
builtMessage.template.components.push(...whatsappComponents)

console.log('✅ Final message to send:');
console.log(JSON.stringify({
  to: builtMessage.to,
  template: builtMessage.template.name,
  language: builtMessage.template.language.code,
  componentCount: builtMessage.template.components.length,
  components: builtMessage.template.components.map((c: any) => ({
    type: c.type,
    hasParameters: !!(c.parameters?.length)
  }))
}, null, 2));

    // Log the final payload (excluding sensitive info)
    const safePayload = {
      messaging_product: builtMessage.messaging_product,
      recipient_type: builtMessage.recipient_type,
      to: builtMessage.to.substring(0, 8) + '...',
      type: builtMessage.type,
      template: {
        name: builtMessage.template.name,
        language: builtMessage.template.language,
        components: builtMessage.template.components?.map((c: any) => ({
          type: c.type,
          parameters: c.parameters?.map((p: any) => ({
            type: p.type,
            hasText: !!p.text,
            hasMedia: !!p.image || !!p.video || !!p.document,
          }))
        }))
      }
    };
    
    console.log('✅ Message built:', JSON.stringify(safePayload, null, 2));

    // 9. Send to WhatsApp API
    console.log('🔍 Step 6: Sending to WhatsApp API...');
    console.log('📤 WhatsApp API URL:', `https://graph.facebook.com/v20.0/${user.whatsappPhoneNumberId}/messages`);
    
    let whatsappResponse;
    try {
      console.log('📤 Sending payload to WhatsApp...');
      whatsappResponse = await whatsappTemplateService.sendTemplateMessage(
        user.whatsappPhoneNumberId!,
        user.whatsappAccessToken!,
        builtMessage
      );
      
      console.log('✅ WhatsApp API response:', {
        hasMessages: !!(whatsappResponse?.messages?.[0]?.id),
        messageId: whatsappResponse?.messages?.[0]?.id,
        hasContacts: !!(whatsappResponse?.contacts?.[0]?.wa_id),
        contactId: whatsappResponse?.contacts?.[0]?.wa_id
      });
      
    } catch (whatsappError: any) {
      console.error('❌ WhatsApp API error:', {
        message: whatsappError.message,
        code: whatsappError.errorCode,
        statusCode: whatsappError.statusCode,
        traceId: whatsappError.fbTraceId
      });
      
      // Save the failed attempt to database
      console.log('💾 Saving failed attempt to database...');
      try {
        const renderedMessage = `[Template: ${template.name}] - FAILED: ${whatsappError.message}`;
        await messageService.sendMessage({
          contactId: contact.id,
          userId: user.id,
          body: renderedMessage,
          direction: 'outgoing',
          messageType: 'template',
          status: 'failed',
          metadata: {
            templateId: template.id,
            templateName: template.name,
            error: whatsappError.message,
            errorCode: whatsappError.errorCode,
            traceId: whatsappError.fbTraceId,
            payload: safePayload,
            mediaUsed: finalParameters?.media,
            sentAt: new Date().toISOString()
          },
        });
        console.log('✅ Failed attempt saved to database');
      } catch (dbError: any) {
        console.error('❌ Failed to save to database:', dbError.message);
      }
      
      throw whatsappError;
    }

    // 10. Render template for database
    console.log('🔍 Step 7: Rendering template for database...');
    
    const bodyComponent = (template.components || []).find((c: any) => c.type === 'BODY');
    let renderedMessage = `[Template: ${template.name}]`;
    
    if (bodyComponent?.text && finalParameters?.variables) {
      renderedMessage = bodyComponent.text;
      const variables = finalParameters.variables;
      
      // Replace all placeholders
      for (let i = 0; i <= 10; i++) {
        const placeholder = `{{${i}}}`;
        if (renderedMessage.includes(placeholder)) {
          const value = variables[i.toString()] || variables[i] || '';
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
          renderedMessage = renderedMessage.replace(regex, value);
        }
      }
      
      // Replace named parameters
      const regex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = regex.exec(bodyComponent.text)) !== null) {
        const fullMatch = match[0];
        const paramName = match[1];
        
        if (variables[paramName] !== undefined) {
          const paramRegex = new RegExp(fullMatch.replace(/[{}]/g, '\\$&'), 'g');
          renderedMessage = renderedMessage.replace(paramRegex, variables[paramName]);
        }
      }
    }
    
    console.log('📝 Final rendered message:', renderedMessage);

    // 11. Save to database
    console.log('🔍 Step 8: Saving to database...');
    let messageResult;
    try {
      messageResult = await messageService.sendMessage({
        contactId: contact.id,
        userId: user.id,
        body: renderedMessage,
        direction: 'outgoing',
        messageType: 'template',
        status: 'sent',
        metadata: {
          templateId: template.id,
          templateName: template.name,
          templateLanguage: template.language,
          originalTemplate: bodyComponent?.text,
          variables: finalParameters?.variables,
          media: finalParameters?.media,
          whatsappMessageId: whatsappResponse?.messages?.[0]?.id,
          whatsappWaId: whatsappResponse?.contacts?.[0]?.wa_id,
          whatsappResponse: whatsappResponse,
          sentAt: new Date().toISOString()
        },
      });
      console.log('✅ Message saved to database:', {
        id: messageResult.message?.id,
        bodyPreview: renderedMessage.substring(0, 100) + (renderedMessage.length > 100 ? '...' : '')
      });
    } catch (dbError: any) {
      console.error('❌ Failed to save to database:', dbError.message);
    }

    console.log('🎉 SUCCESS! Template sent and saved');

    return res.json({
      success: true,
      data: {
        message: messageResult?.message,
        renderedMessage: renderedMessage,
        whatsappResponse: {
          messageId: whatsappResponse?.messages?.[0]?.id,
          contactId: whatsappResponse?.contacts?.[0]?.wa_id,
        },
        template: {
          id: template.id,
          name: template.name,
          language: template.language
        },
        media: finalParameters?.media ? {
          type: finalParameters.media.type,
          url: finalParameters.media.url?.substring(0, 100) + '...',
          sent: true
        } : null
      },
      message: 'Template message sent successfully',
    });

  } catch (error: any) {
    console.error('🔥 CRITICAL ERROR in /send endpoint:', error.message);
    console.error('🔥 Stack trace:', error.stack);
    
    return res.status(error.statusCode || 500).json({
      success: false,
      error: 'Failed to send template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.errorCode,
      traceId: error.fbTraceId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/templates/stats/overview - Get template statistics
router.get('/stats/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await templatesService.getTemplateStats(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch template stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/categories/list - Get template categories
router.get('/categories/list', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await templatesService.getTemplateCategories(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch template categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/:id/preview - Preview template with sample data
router.post('/:id/preview', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    const { sampleData } = req.body;
    
    const result = await templatesService.previewTemplate(
      userId,
      templateId,
      sampleData || {}
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to preview template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/:id/duplicate - Duplicate template
router.post('/:id/duplicate', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    const { name } = req.body;
    
    const result = await templatesService.duplicateTemplate(userId, templateId, name);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to duplicate template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/:id/refresh-status - Refresh status from Meta
router.post('/:id/refresh-status', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await templatesService.refreshTemplateStatus(userId, templateId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error refreshing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh template status',
    });
  }
});

// POST /api/templates/:id/force-sync - Force sync from Meta
router.post('/:id/force-sync', async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    // Get user for access token
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user?.whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured',
      });
    }
    
    // Get template meta ID
    const [template] = await getDb()
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);
    
    if (!template?.metaTemplateId) {
      return res.status(404).json({
        success: false,
        error: 'Template not linked to Meta',
      });
    }
    
    // Get status from Meta
    const metaResult = await MetaTemplateService.getTemplateStatus(
      template.metaTemplateId,
      user.whatsappAccessToken
    );
    
    if (!metaResult.success) {
      return res.status(400).json({
        success: false,
        error: metaResult.error,
      });
    }
    
    // Update local
    const [updated] = await getDb()
      .update(messageTemplates)
      .set({
        status: metaResult.status?.toLowerCase(),
        metaStatus: metaResult.status,
        quality_rating: metaResult.quality_rating,
        lastSyncedAt: new Date(),
      })
      .where(eq(messageTemplates.id, templateId))
      .returning();
    
    res.json({
      success: true,
      data: updated,
      message: 'Template synced from Meta',
    });
    
  } catch (error) {
    console.error('Force sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync template',
    });
  }
});

// ============================================================================
// DEBUG ENDPOINTS
// ============================================================================

// GET /api/templates/:id/debug - Debug template details
router.get('/:id/debug', authenticate, async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    
    const db = getDb();
    
    const [template] = await db.select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Check WhatsApp template directly via API
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let whatsappStatus = null;
    if (template.metaTemplateId && user?.whatsappAccessToken) {
      try {
        const statusResult = await MetaTemplateService.getTemplateStatus(
          template.metaTemplateId,
          user.whatsappAccessToken
        );
        whatsappStatus = statusResult;
      } catch (error: any) {
        whatsappStatus = { 
          error: error.message,
          code: error.errorCode,
          traceId: error.fbTraceId
        };
      }
    }

    // Build preview of what would be sent
    const previewPayload = {
      name: template.name,
      language: template.language,
      components: template.components?.map((c: any) => ({
        type: c.type,
        format: c.format,
        text: c.text?.substring(0, 100) + (c.text && c.text.length > 100 ? '...' : ''),
        hasExample: !!c.example,
        buttonCount: c.buttons?.length || 0
      }))
    };

    return res.json({
      success: true,
      data: {
        localTemplate: {
          id: template.id,
          name: template.name,
          language: template.language,
          status: template.status,
          metaStatus: template.metaStatus,
          metaTemplateId: template.metaTemplateId,
          whatsappTemplateId: template.whatsappTemplateId,
          category: template.category,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          lastSyncedAt: template.lastSyncedAt,
        },
        whatsappStatus,
        previewPayload,
        diagnostic: {
          languageIssue: !template.language.includes('_') ? 
            `Language "${template.language}" might need conversion (e.g., "en" → "en_US")` : 
            'Language format looks OK',
          missingWhatsAppId: !template.metaTemplateId && !template.whatsappTemplateId,
          notApproved: template.status !== 'approved' && template.metaStatus !== 'APPROVED',
          suggestion: template.language === 'en' ? 
            'Try updating language to "en_US" if template exists with that language in WhatsApp' :
            'Use exact language from WhatsApp Business Manager'
        }
      }
    });

  } catch (error: any) {
    console.error('Debug error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Debug failed',
      details: error.message,
    });
  }
});

// POST /api/templates/:id/fix-language - Fix template language
router.post('/:id/fix-language', authenticate, async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    const { language } = req.body;
    
    if (!language) {
      return res.status(400).json({
        success: false,
        error: 'Language is required',
      });
    }

    const db = getDb();
    
    const [template] = await db.select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    console.log(`🔧 Fixing template language: "${template.language}" → "${language}"`);

    const [updated] = await db.update(messageTemplates)
      .set({ 
        language: language,
        updatedAt: new Date()
      })
      .where(eq(messageTemplates.id, templateId))
      .returning();

    return res.json({
      success: true,
      data: updated,
      message: `Template language updated to "${language}"`,
      nextStep: 'Try sending the template again'
    });

  } catch (error: any) {
    console.error('Fix language error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fix template language',
      details: error.message,
    });
  }
});

// POST /api/templates/:id/test-payload - Test payload without sending
router.post('/:id/test-payload', authenticate, async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.userId;
    const { parameters } = req.body;
    
    const db = getDb();
    
    const [template] = await db.select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Build WhatsApp template message
    const whatsappComponents = whatsappTemplateService.convertComponentsToWhatsAppFormat(
      template.components || [],
      parameters || {}
    );

    // Create builder
    const builder = new WhatsAppTemplateBuilder()
      .setRecipient('+1234567890') // Dummy number for testing
      .setTemplate(template.name, template.language);

    const builtMessage = builder.build();
    if (!builtMessage.template.components) {
      builtMessage.template.components = [];
    }
    builtMessage.template.components.push(...whatsappComponents);

    return res.json({
      success: true,
      data: {
        payload: builtMessage,
        analysis: {
          templateName: template.name,
          language: template.language,
          componentCount: builtMessage.template.components.length,
          parameterCount: builtMessage.template.components.reduce((acc, c) => acc + (c.parameters?.length || 0), 0),
          validation: validateTemplateParameters(template, parameters)
        }
      },
      message: 'Payload generated for testing'
    });

  } catch (error: any) {
    console.error('Test payload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate test payload',
      details: error.message,
    });
  }
});

export default router;