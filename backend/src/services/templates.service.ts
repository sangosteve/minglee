// backend/src/services/templates.service.ts - COMPLETE
import { getDb } from '../db/client';
import { messageTemplates, users } from '../db/schema';
import { eq, and, desc, asc, like, sql } from 'drizzle-orm';
import { MetaTemplateService, MetaCreateTemplateData, MetaTemplate } from './meta-template.service';
import { VariableService } from './variable.service';

// Types
export interface CreateTemplateDto {
  name: string;
  category?: string;
  language?: string;
  components: any[];
  variables?: any[];
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  status?: 'pending' | 'approved' | 'rejected' | 'disabled';
}

export interface TemplateFilters {
  search?: string;
  category?: string;
  status?: string;
  language?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  required: boolean;
  example?: string;
  description?: string;
}

export class TemplatesService {
  
  /**
   * GET TEMPLATE STATUS FROM META
   */
  async refreshTemplateStatus(userId: string, templateId: string) {
    try {
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

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      if (!template.metaTemplateId) {
        return {
          success: false,
          error: 'Template not linked to Meta',
        };
      }

      const [user] = await getDb()
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user?.whatsappAccessToken) {
        return {
          success: false,
          error: 'WhatsApp access token not found',
        };
      }

      const statusResult = await MetaTemplateService.getTemplateStatus(
        template.metaTemplateId,
        user.whatsappAccessToken
      );

      if (!statusResult.success) {
        return {
          success: false,
          error: statusResult.error,
        };
      }

      const updatedTemplate = await getDb()
        .update(messageTemplates)
        .set({
          status: statusResult.status?.toLowerCase() || template.status,
          metaStatus: statusResult.status,
          quality_rating: statusResult.quality_rating,
          meta_review_feedback: statusResult.review_feedback,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(messageTemplates.id, templateId))
        .returning();

      return {
        success: true,
        data: updatedTemplate[0],
        message: 'Template status refreshed',
      };

    } catch (error: any) {
      console.error('Status refresh error:', error);
      return {
        success: false,
        error: error.message || 'Failed to refresh template status',
      };
    }
  }

  /**
   * DELETE TEMPLATE - Meta-First
   */
  async deleteTemplate(userId: string, templateId: string) {
    try {
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

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      const [user] = await getDb()
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      let metaDeleteResult = { success: true };

      if (template.metaTemplateId && user?.whatsappBusinessId && user?.whatsappAccessToken) {
        metaDeleteResult = await MetaTemplateService.deleteTemplate(
          user.whatsappBusinessId,
          user.whatsappAccessToken,
          template.name,
          template.metaTemplateId
        );
      }

      await getDb()
        .delete(messageTemplates)
        .where(eq(messageTemplates.id, templateId));

      if (!metaDeleteResult.success) {
        return {
          success: true,
          warning: 'Template deleted locally but failed to delete from WhatsApp',
          message: 'Template removed from your account, but may still exist in WhatsApp',
        };
      }

      return {
        success: true,
        message: 'Template deleted successfully',
      };

    } catch (error: any) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete template',
      };
    }
  }

  /**
   * Convert our format to Meta format - PROPERLY PRESERVES ALL FIELDS
   */
  private convertToMetaFormat(data: CreateTemplateDto): MetaCreateTemplateData {
    console.log('🔍 [convertToMetaFormat] Raw incoming data components:', data.components);
    
    // CRITICAL: Use JSON serialization to ensure we have plain objects
    // This prevents issues with class instances or getters/setters
    const serializedComponents = JSON.parse(JSON.stringify(data.components));
    
    console.log('🔍 [convertToMetaFormat] Serialized components:', JSON.stringify(serializedComponents, null, 2));
    
    // Transform to Meta format while preserving ALL fields
    const metaComponents = serializedComponents.map((comp: any) => {
      const result: any = {};
      
      // Copy ALL properties including example (CRITICAL!)
      Object.keys(comp).forEach(key => {
        result[key] = comp[key];
      });
      
      // Ensure proper casing for Meta API
      result.type = result.type?.toUpperCase();
      
      if (result.format) {
        result.format = result.format.toUpperCase();
      }
      
      if (result.buttons) {
        result.buttons = result.buttons.map((btn: any) => ({
          ...btn,
          type: btn.type?.toUpperCase(),
        }));
      }
      
      // DEBUG: Log each component to ensure example is present
      console.log(`🔍 [convertToMetaFormat] Processing component ${result.type}:`, {
        format: result.format,
        hasExample: !!result.example,
        exampleKeys: result.example ? Object.keys(result.example) : [],
        allKeys: Object.keys(result),
      });
      
      return result;
    });

    const metaData = {
      name: data.name,
      category: (data.category?.toUpperCase() as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION') || 'UTILITY',
      language: data.language?.includes('_') ? data.language : `${data.language || 'en'}_US`,
      components: metaComponents,
      allow_category_change: true,
    };

    console.log('📦 [convertToMetaFormat] FINAL Meta API payload:', JSON.stringify(metaData, null, 2));
    
    return metaData;
  }


  

  /**
   * Extract variables from components
   */
  private extractVariablesFromComponents(components: any[]): TemplateVariable[] {
    const variables = new Map<string, TemplateVariable>();
    
    components.forEach(component => {
      if (component.text) {
        const varNames = VariableService.extractVariables(component.text);
        varNames.forEach(varName => {
          if (!variables.has(varName)) {
            variables.set(varName, {
              name: varName,
              type: 'text',
              required: false,
              example: `Sample ${variables.size + 1}`,
            });
          }
        });
      }
    });
    
    return Array.from(variables.values());
  }

  /**
   * Extract variables from Meta components
   */
  private extractVariablesFromMetaComponents(components: any[]): TemplateVariable[] {
    const variables = new Map<string, TemplateVariable>();
    
    components.forEach(component => {
      if (component.type === 'BODY' && component.example?.body_text_named_params) {
        component.example.body_text_named_params.forEach((param: any) => {
          if (!variables.has(param.param_name)) {
            variables.set(param.param_name, {
              name: param.param_name,
              type: 'text',
              required: false,
              example: param.example,
            });
          }
        });
      }
    });
    
    return Array.from(variables.values());
  }

  /**
   * Schedule background status check
   */
  private scheduleStatusCheck(localId: string, metaId: string, accessToken: string) {
    setTimeout(async () => {
      try {
        const status = await MetaTemplateService.getTemplateStatus(metaId, accessToken);
        if (status.success) {
          await getDb()
            .update(messageTemplates)
            .set({
              status: status.status?.toLowerCase(),
              metaStatus: status.status,
              updatedAt: new Date(),
            })
            .where(eq(messageTemplates.id, localId));
        }
      } catch (error) {
        console.error('Background status check failed:', error);
      }
    }, 60000);
  }

  /**
   * Get all templates for a user
   */
  async getTemplates(userId: string, filters: TemplateFilters = {}) {
    try {
      const {
        search,
        category,
        status,
        language,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const conditions = [eq(messageTemplates.userId, userId)];

      if (status && status !== 'all') {
        conditions.push(eq(messageTemplates.status, status));
      }

      if (category && category !== 'all') {
        conditions.push(eq(messageTemplates.category, category));
      }

      if (language && language !== 'all') {
        conditions.push(eq(messageTemplates.language, language));
      }

      if (search) {
        conditions.push(like(messageTemplates.name, `%${search}%`));
      }

      const orderByField = sortBy === 'name' ? messageTemplates.name :
                         sortBy === 'updatedAt' ? messageTemplates.updatedAt :
                         messageTemplates.createdAt;
      
      const orderBy = sortOrder === 'asc' 
        ? asc(orderByField) 
        : desc(orderByField);

      const data = await getDb()
        .select()
        .from(messageTemplates)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);

      const [{ count }] = await getDb()
        .select({ count: sql`count(*)` })
        .from(messageTemplates)
        .where(and(...conditions));

      return {
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: Number(count),
          pages: Math.ceil(Number(count) / limitNum),
        },
      };
    } catch (error) {
      console.error('Error fetching templates:', error);
      return {
        success: false,
        error: 'Failed to fetch templates',
      };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(userId: string, templateId: string) {
    try {
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

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return {
        success: true,
        data: template,
      };
    } catch (error) {
      console.error('Error fetching template:', error);
      return {
        success: false,
        error: 'Failed to fetch template',
      };
    }
  }

  /**
   * Update template
   */
  async updateTemplate(userId: string, templateId: string, data: UpdateTemplateDto) {
    try {
      const [existing] = await getDb()
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.id, templateId),
            eq(messageTemplates.userId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      if (existing.metaTemplateId && data.status) {
        const [template] = await getDb()
          .update(messageTemplates)
          .set({
            status: data.status,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(messageTemplates.id, templateId),
              eq(messageTemplates.userId, userId)
            )
          )
          .returning();

        return {
          success: true,
          data: template,
          message: 'Template status updated',
        };
      }

      const [template] = await getDb()
        .update(messageTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messageTemplates.id, templateId),
            eq(messageTemplates.userId, userId)
          )
        )
        .returning();

      return {
        success: true,
        data: template,
        message: 'Template updated successfully',
      };
    } catch (error) {
      console.error('Error updating template:', error);
      return {
        success: false,
        error: 'Failed to update template',
      };
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    userId: string,
    templateId: string,
    contactId: string,
    parameters: Record<string, any>
  ) {
    try {
      const templateResult = await this.getTemplate(userId, templateId);
      if (!templateResult.success) {
        return templateResult;
      }

      const template = templateResult.data;

      if (template.metaStatus !== 'APPROVED' && template.status !== 'approved') {
        return {
          success: false,
          error: 'Template is not approved in WhatsApp. Status: ' + (template.metaStatus || template.status),
        };
      }

      // Note: You need to import your contacts table
      return {
        success: false,
        error: 'Contact functionality not implemented',
      };
    } catch (error: any) {
      console.error('Error sending template message:', error);
      return {
        success: false,
        error: 'Failed to send template message',
      };
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(userId: string) {
    try {
      const stats = await getDb()
        .select({
          status: messageTemplates.status,
          category: messageTemplates.category,
          count: sql`count(*)`,
        })
        .from(messageTemplates)
        .where(eq(messageTemplates.userId, userId))
        .groupBy(messageTemplates.status, messageTemplates.category);

      const totalTemplates = stats.reduce((acc, stat) => acc + Number(stat.count), 0);

      const categories = stats.reduce((acc: any, stat) => {
        if (!acc[stat.category || 'uncategorized']) {
          acc[stat.category || 'uncategorized'] = 0;
        }
        acc[stat.category || 'uncategorized'] += Number(stat.count);
        return acc;
      }, {});

      return {
        success: true,
        data: {
          total: totalTemplates,
          byStatus: stats.map(stat => ({
            status: stat.status,
            count: Number(stat.count),
          })),
          byCategory: Object.entries(categories).map(([category, count]) => ({
            category,
            count,
          })),
          approvedCount: stats
            .filter(stat => stat.status === 'approved' || stat.metaStatus === 'APPROVED')
            .reduce((acc, stat) => acc + Number(stat.count), 0),
        },
      };
    } catch (error) {
      console.error('Error fetching template stats:', error);
      return {
        success: false,
        error: 'Failed to fetch template stats',
      };
    }
  }

  /**
   * Get template categories
   */
  async getTemplateCategories(userId: string) {
    try {
      const categories = await getDb()
        .selectDistinct({
          category: messageTemplates.category,
        })
        .from(messageTemplates)
        .where(eq(messageTemplates.userId, userId));

      return {
        success: true,
        data: categories.map(c => c.category || 'uncategorized'),
      };
    } catch (error) {
      console.error('Error fetching template categories:', error);
      return {
        success: false,
        error: 'Failed to fetch template categories',
      };
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(userId: string, templateId: string, sampleData: Record<string, any>) {
    try {
      const templateResult = await this.getTemplate(userId, templateId);
      if (!templateResult.success) {
        return templateResult;
      }

      const template = templateResult.data;
      
      const previewComponents = template.components.map((component: any) => {
        if (component.text) {
          const previewText = VariableService.replaceVariables(component.text, sampleData);
          return {
            ...component,
            text: previewText,
          };
        }
        return component;
      });

      return {
        success: true,
        data: {
          template,
          preview: {
            components: previewComponents,
            sampleData,
          },
        },
      };
    } catch (error) {
      console.error('Error previewing template:', error);
      return {
        success: false,
        error: 'Failed to preview template',
      };
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(userId: string, templateId: string, name?: string) {
    try {
      const originalResult = await this.getTemplate(userId, templateId);
      if (!originalResult.success) {
        return originalResult;
      }

      const original = originalResult.data;
      const newName = name || `${original.name}_copy`;

      let metaTemplateId = null;
      let metaResult = null;

      if (original.metaTemplateId) {
        const [user] = await getDb()
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user?.whatsappBusinessId && user?.whatsappAccessToken) {
          metaResult = await MetaTemplateService.createTemplate(
            user.whatsappBusinessId,
            user.whatsappAccessToken,
            {
              name: newName,
              category: (original.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION') || 'UTILITY',
              language: original.language || 'en_US',
              components: original.components,
            }
          );

          if (metaResult.success) {
            metaTemplateId = metaResult.data?.id;
          }
        }
      }

      const [duplicate] = await getDb()
        .insert(messageTemplates)
        .values({
          name: newName,
          category: original.category,
          language: original.language,
          status: metaTemplateId ? 'pending' : 'draft',
          components: original.components,
          variables: original.variables || [],
          whatsappTemplateId: metaTemplateId,
          metaTemplateId,
          metaStatus: metaTemplateId ? 'PENDING' : null,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: duplicate,
        message: metaTemplateId 
          ? 'Template duplicated and submitted for WhatsApp review'
          : 'Template duplicated locally',
      };

    } catch (error) {
      console.error('Error duplicating template:', error);
      return {
        success: false,
        error: 'Failed to duplicate template',
      };
    }
  }

  /**
   * Get WhatsApp credentials from environment
   */
private getWhatsAppCredentials() {
  const businessId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  
  // Log what's available for debugging
  console.log('🔍 [getWhatsAppCredentials] Environment check:', {
    hasBusinessId: !!businessId,
    hasAccessToken: !!accessToken,
    hasPhoneNumberId: !!phoneNumberId,
    businessIdLength: businessId?.length,
    accessTokenLength: accessToken?.length,
    phoneNumberIdLength: phoneNumberId?.length,
  });
  
  if (!businessId || !accessToken) {
    console.error('❌ [getWhatsAppCredentials] Missing required WhatsApp credentials');
    return null;
  }
  
  return {
    businessId,
    accessToken,
    phoneNumberId, // Can be undefined if not configured
  };
}

  /**
   * CREATE TEMPLATE - FIXED WITH PROPER SERIALIZATION
   */
async createTemplate(userId: string, data: CreateTemplateDto) {
  try {
    console.log('🚀 [createTemplate] Starting template creation for user:', userId);
    console.log('📝 [createTemplate] Raw incoming data:', JSON.stringify(data, null, 2));

    // 1. Get WhatsApp credentials from environment
    const credentials = this.getWhatsAppCredentials();
    if (!credentials) {
      return {
        success: false,
        error: 'WhatsApp Business account not configured in environment variables',
      };
    }

    console.log('✅ [createTemplate] Using WhatsApp credentials:', {
      businessId: credentials.businessId.substring(0, 10) + '...',
      hasAccessToken: !!credentials.accessToken,
      hasPhoneNumberId: !!credentials.phoneNumberId,
    });

    // 2. Check if we need phoneNumberId for media upload
    const hasMediaHeader = data.components.some(
      comp => comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)
    );

    if (hasMediaHeader && !credentials.phoneNumberId) {
      console.error('❌ [createTemplate] Media header found but no phoneNumberId configured');
      return {
        success: false,
        error: 'Phone Number ID is required for templates with media headers (IMAGE/VIDEO/DOCUMENT). Please configure WHATSAPP_PHONE_NUMBER_ID in environment variables.',
      };
    }

    // 3. Convert to Meta format
    const metaData: MetaCreateTemplateData = this.convertToMetaFormat(data);
    
    console.log('🔧 [createTemplate] Converted to Meta format');

    // 4. Send to Meta API - PASS phoneNumberId for media upload
    console.log('📤 [createTemplate] Calling MetaTemplateService.createTemplate...');
    console.log('   Business ID:', credentials.businessId);
    console.log('   Phone Number ID:', credentials.phoneNumberId || 'Not provided (no media headers)');
    
    const metaResult = await MetaTemplateService.createTemplate(
      credentials.businessId,
      credentials.accessToken,
      metaData,
      credentials.phoneNumberId // <-- PASS phoneNumberId here!
    );

    console.log('📥 [createTemplate] Meta API result:', {
      success: metaResult.success,
      templateId: metaResult.data?.id,
      error: metaResult.error,
      code: metaResult.code,
    });

    // 5. Handle Meta API failure
    if (!metaResult.success) {
      let errorMessage = metaResult.error || 'Failed to create template in WhatsApp';
      
      // Provide more helpful error messages
      if (metaResult.code === 100 && errorMessage.includes('Invalid parameter')) {
        errorMessage = 'Template validation failed. Please check: 1) Template name format (lowercase, underscores only), 2) Media files are valid and accessible, 3) Button types match category rules.';
      }
      
      return {
        success: false,
        error: errorMessage,
        metaError: true,
        code: metaResult.code,
        fbtrace_id: metaResult.fbtrace_id,
      };
    }

    // 6. Extract variables from components
    const variables = this.extractVariablesFromComponents(data.components);

    // 7. Save to local database with Meta ID
    const [template] = await getDb()
      .insert(messageTemplates)
      .values({
        name: data.name,
        category: data.category?.toUpperCase() || 'UTILITY',
        language: data.language || 'en_US',
        status: 'pending',
        components: data.components,
        variables: variables,
        whatsappTemplateId: metaResult.data?.id,
        metaTemplateId: metaResult.data?.id,
        metaStatus: 'PENDING',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
      })
      .returning();

    console.log('✅ [createTemplate] Saved to local DB:', template.id);

    return {
      success: true,
      data: {
        ...template,
        metaTemplateId: metaResult.data?.id,
        metaStatus: 'PENDING',
      },
      message: '✅ Template submitted to WhatsApp for review. Approval usually takes 1-24 hours.',
      metaResponse: metaResult.data,
    };

  } catch (error: any) {
    console.error('❌ [createTemplate] Template creation error:', {
      error: error.message,
      stack: error.stack,
      userId,
    });
    
    return {
      success: false,
      error: 'Internal server error. Please try again.',
      details: error.message,
    };
  }
}

  /**
   * SYNC TEMPLATES FROM META - Use environment variables
   */
async syncWhatsAppTemplates(userId: string, userData?: any) {
  try {
    console.log('🔄 Syncing templates from Meta for user:', userId);

    const credentials = this.getWhatsAppCredentials();
    if (!credentials) {
      return {
        success: false,
        error: 'WhatsApp Business account not configured in environment variables',
      };
    }

    console.log('✅ Using WhatsApp credentials from environment for sync');

    // FIX: Remove the status parameter entirely to get ALL templates
    const metaResult = await MetaTemplateService.getAllTemplates(
      credentials.businessId,
      credentials.accessToken
      // Don't pass status parameter - defaults to getting all templates
    );

    if (!metaResult.success) {
      return {
        success: false,
        error: metaResult.error,
      };
    }

    const metaTemplates = metaResult.data || [];
    console.log(`✅ Found ${metaTemplates.length} templates in Meta`);

    const syncedTemplates = [];
    const errors = [];

    for (const metaTemplate of metaTemplates) {
      try {
        const variables = this.extractVariablesFromMetaComponents(metaTemplate.components);

        const templateData = {
          name: metaTemplate.name,
          category: metaTemplate.category,
          language: metaTemplate.language,
          status: metaTemplate.status.toLowerCase(),
          components: metaTemplate.components,
          variables,
          whatsappTemplateId: metaTemplate.id,
          metaTemplateId: metaTemplate.id,
          metaStatus: metaTemplate.status,
          quality_rating: metaTemplate.quality_rating,
          userId,
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
        };

        const existing = await getDb()
          .select()
          .from(messageTemplates)
          .where(
            and(
              eq(messageTemplates.metaTemplateId, metaTemplate.id),
              eq(messageTemplates.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await getDb()
            .update(messageTemplates)
            .set(templateData)
            .where(eq(messageTemplates.id, existing[0].id));
          
          syncedTemplates.push({
            id: existing[0].id,
            name: metaTemplate.name,
            action: 'updated',
            status: metaTemplate.status,
          });
        } else {
          const [newTemplate] = await getDb()
            .insert(messageTemplates)
            .values({
              ...templateData,
              createdAt: new Date(),
            })
            .returning();
          
          syncedTemplates.push({
            id: newTemplate.id,
            name: metaTemplate.name,
            action: 'created',
            status: metaTemplate.status,
          });
        }
      } catch (templateError) {
        console.error(`❌ Error syncing template ${metaTemplate.name}:`, templateError);
        errors.push({
          name: metaTemplate.name,
          error: templateError instanceof Error ? templateError.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      data: {
        synced: syncedTemplates,
        total: metaTemplates.length,
        errors,
      },
      message: `✅ Synced ${syncedTemplates.length} templates from WhatsApp. ${errors.length} errors.`,
    };

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync templates from WhatsApp',
    };
  }
}
}



export const templatesService = new TemplatesService();