// backend/src/services/broadcast.service.ts
import { getDb } from '../db/client';
import { broadcasts, broadcastMessages, contacts, users, messageTemplates, tags } from '../db/schema';
import { eq, and, inArray, desc, asc, sql, or, like } from 'drizzle-orm';
import { WhatsAppService } from './whatsapp.service';
import { messageService } from '../services/message/message.service';

// Define proper types for stats
interface BroadcastStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface CreateBroadcastDto {
  name: string;
  templateId?: string;
  audienceType: 'all' | 'tags' | 'segments' | 'contacts';
  audienceFilter: {
    tags?: string[];
    segments?: string[];
    contacts?: string[];
  };
  variables?: Record<string, string>;
  mediaUrl?: string;
  scheduleType: 'now' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
  message?: string;
  mediaAttachmentId?: string;
}

export interface UpdateBroadcastDto {
  name?: string;
  status?: string;
  scheduledAt?: Date;
}

export class BroadcastService {
  
  /**
   * Create a new broadcast
   */
  async createBroadcast(userId: string, data: CreateBroadcastDto): Promise<{ success: boolean; data?: any; error?: string }> {
    const db = getDb();
    
    try {
      console.log('\n🎬 CREATE BROADCAST: Starting...');
      console.log('📊 Data:', {
        name: data.name,
        templateId: data.templateId,
        audienceType: data.audienceType,
        scheduleType: data.scheduleType
      });
      
      // Calculate audience size - handle database errors gracefully
      let audienceCount = 0;
      try {
        audienceCount = await this.calculateAudienceSize(userId, data.audienceType, data.audienceFilter);
      } catch (countError: any) {
        console.error('⚠️ Error calculating audience size, using 0:', countError.message);
        audienceCount = 0;
      }
      

      // Determine scheduled time
      let scheduledAt: Date | null = null;
      if (data.scheduleType === 'scheduled' && data.scheduledDate && data.scheduledTime) {
        scheduledAt = new Date(`${data.scheduledDate}T${data.scheduledTime}`);
        // If scheduled time is in the past, schedule for immediate sending
        if (scheduledAt < new Date()) {
          scheduledAt = new Date();
        }
      }
      
      // Determine initial status
      let status: 'draft' | 'scheduled' | 'sending' = 'draft';
      if (data.scheduleType === 'now') {
        status = 'sending';
      } else if (scheduledAt) {
        status = 'scheduled';
      }
      

      


      if (data.templateId) {
        try {
          const [template] = await db.select()
            .from(messageTemplates)
            .where(eq(messageTemplates.id, data.templateId))
            .limit(1);
          
          if (template) {
            
            // Validate variables match template requirements
            const requiredVariables = this.extractTemplateVariables(template);
            console.log('📊 Template requires variables:', requiredVariables);
            
            if (data.variables) {
              const missingVariables = requiredVariables.filter(v => !data.variables?.[v]);
              if (missingVariables.length > 0) {
                console.warn('⚠️ Missing template variables:', missingVariables);
              }
            }
          }
        } catch (templateError: any) {
          console.error('⚠️ Error fetching template:', templateError.message);
        }
      }
      
      // Create broadcast
      console.log('📝 Creating broadcast record...');
      
      // Create stats object with proper type
      const stats: BroadcastStats = {
        total: audienceCount,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
      };
      
      const [broadcast] = await db.insert(broadcasts).values({
        userId,
        name: data.name,
        templateId: data.templateId || null,
        audienceType: data.audienceType,
        audienceFilter: data.audienceFilter,
        audienceCount,
        variables: data.variables || {},
        mediaUrl: data.mediaUrl || null,
        message: data.message || null,
        mediaAttachmentId: data.mediaAttachmentId || null,
        status,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        stats: stats,
        metadata: {},
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning();
      
      console.log(`✅ Broadcast created: ${broadcast?.id} with status ${broadcast?.status}`);
      
      // If sending now, start the broadcast
      if (status === 'sending') {
        console.log(`🚀 Starting broadcast immediately (scheduleType: now)`);
        
        // Use setTimeout to ensure this runs in background
        setTimeout(async () => {
          try {
            console.log(`🎬 Background: Starting broadcast ${broadcast?.id}`);
            const result = await this.startBroadcast(broadcast?.id||'');
            if (result.success) {
              console.log(`✅ Background: Broadcast ${broadcast?.id} started successfully`);
            } else {
              console.error(`❌ Background: Failed to start broadcast: ${result.error}`);
            }
          } catch (error: any) {
            console.error(`❌ Background: Error starting broadcast:`, error.message);
          }
        }, 100); // Small delay
      }
      
      return {
        success: true,
        data: broadcast,
      };
      
    } catch (error: any) {
      console.error('❌ Error creating broadcast:', error.message);
      console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Calculate audience size
   */
  async calculateAudienceSize(
    userId: string,
    audienceType: string,
    audienceFilter: any
  ): Promise<number> {
    const db = getDb();
    
    try {
      console.log(`🔍 Calculating audience size for user ${userId}, type: ${audienceType}`);
      console.log(`🔍 Audience filter:`, audienceFilter);
      
      let count = 0;
      
      switch (audienceType) {
        case 'all':
          try {
            // Count ALL contacts for user (no filters)
            const [allResult] = await db.select({ count: sql<number>`count(*)` })
              .from(contacts)
              .where(eq(contacts.userId, userId));
            count = Number(allResult?.count || 0);
            console.log(`📊 Found ${count} total contacts (no filters)`);
          } catch (dbError: any) {
            console.error('❌ Database error counting contacts:', dbError.message);
            count = 0;
          }
          break;
          
        case 'tags':
          if (audienceFilter.tags && audienceFilter.tags.length > 0) {
            try {
              // Count contacts with specific tags (no optIn/status filters)
              console.log(`🔍 Counting contacts with tags:`, audienceFilter.tags);
              const tagCounts = await db.execute(sql`
                SELECT COUNT(DISTINCT c.id) as count
                FROM contacts c
                WHERE c.user_id = ${userId}
                AND c.tag_ids && ${JSON.stringify(audienceFilter.tags)}::uuid[]
              `);
              count = Number(tagCounts.rows[0]?.count || 0);
              console.log(`📊 Found ${count} contacts with specified tags`);
            } catch (dbError: any) {
              console.error('❌ Database error counting tag contacts:', dbError.message);
              count = 0;
            }
          }
          break;
          
        case 'contacts':
          if (audienceFilter.contacts && audienceFilter.contacts.length > 0) {
            try {
              // Count specific contacts (no optIn/status filters)
              console.log(`🔍 Counting specific contacts:`, audienceFilter.contacts.length);
              const [contactsResult] = await db.select({ count: sql<number>`count(*)` })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.userId, userId),
                    inArray(contacts.id, audienceFilter.contacts)
                  )
                );
              count = Number(contactsResult?.count || 0);
              console.log(`📊 Found ${count} of ${audienceFilter.contacts.length} specified contacts`);
            } catch (dbError: any) {
              console.error('❌ Database error counting specific contacts:', dbError.message);
              count = 0;
            }
          }
          break;
          
        default:
          count = 0;
      }
      
      return count;
      
    } catch (error: any) {
      console.error('❌ Error calculating audience size:', error.message);
      return 0;
    }
  }
  
  /**
   * Get broadcasts for user
   */
  async getBroadcasts(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const db = getDb();
    
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      const offset = (page - 1) * limit;
      
      // Build where conditions
      const conditions: any[] = [eq(broadcasts.userId, userId)];
      
if (status && status !== 'all') {
  const validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'paused'] as const;
  type BroadcastStatus = typeof validStatuses[number];
  
  if (validStatuses.includes(status as BroadcastStatus)) {
    conditions.push(eq(broadcasts.status, status as BroadcastStatus));
  }
}
      
      if (search) {
        conditions.push(like(broadcasts.name, `%${search}%`));
      }
      
      // Build query
      const query = db.select()
        .from(broadcasts)
        .where(and(...conditions));
      
      // Apply sorting
      const sortField = {
        'name': broadcasts.name,
        'status': broadcasts.status,
        'scheduledAt': broadcasts.scheduledAt,
        'sentAt': broadcasts.sentAt,
        'createdAt': broadcasts.createdAt,
        'updatedAt': broadcasts.updatedAt,
      }[sortBy] || broadcasts.createdAt;
      
      const sortedQuery = query.orderBy(
        sortOrder === 'desc' ? desc(sortField) : asc(sortField)
      );
      
      // Get paginated results
      const broadcastsList = await sortedQuery
        .limit(limit)
        .offset(offset);
      
      // Get total count
      const totalResult = await db.select({ count: sql<number>`count(*)` })
        .from(broadcasts)
        .where(and(...conditions));
      
      const total = totalResult.length > 0 ? Number(totalResult[0]?.count || 0) : 0;
      
      return {
        success: true,
        data: {
          broadcasts: broadcastsList,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
      
    } catch (error: any) {
      console.error('Error getting broadcasts:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Get broadcast by ID
   */
  async getBroadcast(userId: string, broadcastId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const db = getDb();
    
    try {
      const [broadcast] = await db.select()
        .from(broadcasts)
        .where(
          and(
            eq(broadcasts.id, broadcastId),
            eq(broadcasts.userId, userId)
          )
        )
        .limit(1);
      
      if (!broadcast) {
        return {
          success: false,
          error: 'Broadcast not found',
        };
      }
      
      // Get broadcast messages
      const messages = await db.select()
        .from(broadcastMessages)
        .leftJoin(contacts, eq(broadcastMessages.contactId, contacts.id))
        .where(eq(broadcastMessages.broadcastId, broadcastId))
        .orderBy(desc(broadcastMessages.createdAt))
        .limit(100); // Limit to recent messages
      
      return {
        success: true,
        data: {
          broadcast,
          messages: messages.map(m => ({
            ...m.broadcast_messages,
            contact: m.contacts,
          })),
        },
      };
      
    } catch (error: any) {
      console.error('Error getting broadcast:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Start a broadcast (send immediately)
   */
  async startBroadcast(broadcastId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDb();
    
    try {
      console.log(`\n🚀 START BROADCAST: Starting broadcast ${broadcastId}`);
      
      const [broadcast] = await db.select()
        .from(broadcasts)
        .where(eq(broadcasts.id, broadcastId))
        .limit(1);
      
      if (!broadcast) {
        console.error(`❌ Broadcast ${broadcastId} not found`);
        return { success: false, error: 'Broadcast not found' };
      }
      
      console.log(`📊 Broadcast current status: ${broadcast.status}`);
      
      // Allow starting from 'sending' status (in case it was set but never actually started)
      if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled' && broadcast.status !== 'sending') {
        console.error(`❌ Cannot start broadcast with status: ${broadcast.status}`);
        return { success: false, error: `Cannot start broadcast with status: ${broadcast.status}` };
      }
      
      // Update broadcast status to 'sending' if it's not already
      if (broadcast.status !== 'sending') {
        await db.update(broadcasts)
          .set({
            status: 'sending',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(broadcasts.id, broadcastId));
        console.log(`✅ Updated broadcast status to 'sending'`);
      } else {
        console.log(`ℹ️ Broadcast already has status 'sending'`);
      }
      
      // Get user
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, broadcast.userId))
        .limit(1);
      
      if (!user) {
        console.error(`❌ User ${broadcast.userId} not found`);
        return { success: false, error: 'User not found' };
      }
      
      console.log(`👤 Found user: ${user.email}`);
      console.log(`🔐 WhatsApp configured: ${!!user.whatsappPhoneNumberId && !!user.whatsappAccessToken}`);
      
      if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
        console.error(`❌ User ${user.email} doesn't have WhatsApp configured`);
        
        // Update broadcast to failed status
        await db.update(broadcasts)
          .set({
            status: 'failed',
            error: 'WhatsApp not configured for user',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(broadcasts.id, broadcastId));
        
        return { success: false, error: 'WhatsApp not configured for user' };
      }
      
      // Get contacts based on audience
      console.log(`👥 Getting audience contacts...`);
      let contactsList: any[] = [];
      try {
        contactsList = await this.getAudienceContacts(
          broadcast.userId,
          broadcast.audienceType||'all',
          broadcast.audienceFilter
        );
      } catch (contactsError: any) {
        console.error(`❌ Error getting contacts:`, contactsError.message);
        contactsList = [];
      }
      
      console.log(`📊 Found ${contactsList.length} contacts for broadcast`);
      
      if (contactsList.length === 0) {
        console.log(`⚠️ No contacts to send to, marking as completed`);
        
        await db.update(broadcasts)
          .set({
            status: 'sent',
            sentAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(broadcasts.id, broadcastId));
        
        return { success: true, error: 'No contacts to send to' };
      }
      
      // Log first few contacts
      console.log(`📋 First 3 contacts:`, contactsList.slice(0, 3).map(c => ({
        id: c.id,
        phone: c.phone,
        name: c.name
      })));
      
      // Create broadcast messages for each contact
      const broadcastMessagesData = contactsList.map(contact => ({
        broadcastId: broadcast.id,
        contactId: contact.id,
        status: 'pending',
        scheduledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      console.log(`📝 Creating ${broadcastMessagesData.length} broadcast message records...`);
      
      if (broadcastMessagesData.length > 0) {
        try {
          await db.insert(broadcastMessages).values(broadcastMessagesData);
          console.log(`✅ Created broadcast message records`);
        } catch (insertError: any) {
          console.error(`❌ Error creating broadcast messages:`, insertError.message);
          
          // Continue anyway - we'll try to send to contacts we can
          if (insertError.message.includes('broadcast_messages')) {
            console.log(`⚠️ Broadcast messages table might not exist, but continuing...`);
          }
        }
      }
      
      // Start sending messages (in background)
      console.log(`🚀 Starting background message sending...`);
      
      // Use setTimeout to ensure this runs in background without blocking response
      setTimeout(async () => {
        try {
          console.log(`\n🎬 Background sending started for broadcast ${broadcast.id}`);
          await this.sendBroadcastMessages(broadcast, user, contactsList);
        } catch (error: any) {
          console.error(`❌ Background sending error:`, error.message);
        }
      }, 100); // Small delay to ensure response is sent first
      
      console.log(`✅ Broadcast ${broadcastId} started successfully`);
      return { success: true };
      
    } catch (error: any) {
      console.error(`❌ Error starting broadcast:`, error.message);
      console.error(`❌ Error stack:`, error.stack);
      
      // Update broadcast to failed status
      try {
        await db.update(broadcasts)
          .set({
            status: 'failed',
            error: error.message,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(broadcasts.id, broadcastId));
      } catch (updateError) {
        console.error(`❌ Error updating broadcast status:`, updateError);
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get contacts for audience
   */
  private async getAudienceContacts(
    userId: string,
    audienceType: string,
    audienceFilter: any
  ): Promise<any[]> {
    const db = getDb();
    
    try {
      console.log(`🔍 Getting contacts for user ${userId}, type: ${audienceType}`);
      
      let contactsList: any[] = [];
      
      switch (audienceType) {
        case 'all':
          try {
            // Get ALL contacts for user (no filters)
            contactsList = await db.select()
              .from(contacts)
              .where(eq(contacts.userId, userId));
            console.log(`✅ Found ${contactsList.length} contacts for 'all' audience (no filters)`);
          } catch (error: any) {
            console.error(`❌ Error getting 'all' contacts:`, error.message);
            contactsList = [];
          }
          break;
          
        case 'tags':
          if (audienceFilter.tags && audienceFilter.tags.length > 0) {
            try {
              contactsList = await db.select()
                .from(contacts)
                .where(
                  and(
                    eq(contacts.userId, userId),
                    sql`${contacts.tagIds} && ${JSON.stringify(audienceFilter.tags)}::uuid[]`
                  )
                );
              console.log(`✅ Found ${contactsList.length} contacts for 'tags' audience`);
            } catch (error: any) {
              console.error(`❌ Error getting 'tags' contacts:`, error.message);
              contactsList = [];
            }
          }
          break;
          
        case 'contacts':
          if (audienceFilter.contacts && audienceFilter.contacts.length > 0) {
            try {
              contactsList = await db.select()
                .from(contacts)
                .where(
                  and(
                    eq(contacts.userId, userId),
                    inArray(contacts.id, audienceFilter.contacts)
                  )
                );
              console.log(`✅ Found ${contactsList.length} contacts for 'contacts' audience`);
            } catch (error: any) {
              console.error(`❌ Error getting 'contacts' audience:`, error.message);
              contactsList = [];
            }
          }
          break;
      }
      
      // Log some sample contacts
      if (contactsList.length > 0) {
        console.log(`📋 Sample contacts:`, contactsList.slice(0, 3).map(c => ({
          id: c.id,
          phone: c.phone,
          name: c.name
        })));
      }
      
      return contactsList;
      
    } catch (error: any) {
      console.error('❌ Error in getAudienceContacts:', error.message);
      return [];
    }
  }
  
  /**
   * Send broadcast messages
   */
  private async sendBroadcastMessages(
    broadcast: any,
    user: any,
    contacts: any[]
  ): Promise<void> {
    const db = getDb();
    
    try {
      console.log(`\n🎬 SEND BROADCAST MESSAGES: Starting for broadcast ${broadcast.id}`);
      console.log(`📊 Total contacts: ${contacts.length}`);
      console.log(`👤 User: ${user.email}`);
      
      if (!contacts || contacts.length === 0) {
        console.log(`⚠️ No contacts to send to`);
        
        await db.update(broadcasts)
          .set({
            status: 'sent',
            sentAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(broadcasts.id, broadcast.id));
        
        return;
      }
      
      let sentCount = 0;
      let failedCount = 0;
      
      // Rate limiting: send 5 messages per second to avoid WhatsApp limits
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 1000; // 1 second
      
      console.log(`⚙️ Using batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY}ms`);
      
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(contacts.length/BATCH_SIZE)}`);
        console.log(`📱 Batch contacts:`, batch.map(c => c.phone));
        
        // Send batch in parallel
        const batchPromises = batch.map(contact => 
          this.sendBroadcastMessage(broadcast, user, contact)
            .then(result => ({ 
              success: true, 
              contactId: contact.id,
              contactPhone: contact.phone,
              result 
            }))
            .catch(error => ({ 
              success: false, 
              contactId: contact.id,
              contactPhone: contact.phone,
              error: error.message 
            }))
        );
        
        console.log(`🚀 Sending ${batch.length} messages in parallel...`);
        const results = await Promise.allSettled(batchPromises);
        
        // Process results
        results.forEach((promiseResult, index) => {
          const contact = batch[index];
          
          if (promiseResult.status === 'fulfilled') {
            const result = promiseResult.value;
            if (result.success) {
              sentCount++;
              console.log(`✅ Sent to ${contact.phone}`);
            } else {
              failedCount++;
       
            }
          } else {
            failedCount++;
            console.error(`❌ Promise rejected for ${contact.phone}:`, promiseResult.reason);
          }
        });
        
        // Update broadcast stats
        console.log(`📊 Progress: ${sentCount + failedCount}/${contacts.length} sent`);
        
        // Get current stats
        const [currentBroadcast] = await db.select()
          .from(broadcasts)
          .where(eq(broadcasts.id, broadcast.id))
          .limit(1);
        
        if (currentBroadcast) {
          const stats: BroadcastStats = currentBroadcast.stats as BroadcastStats || {
            total: contacts.length,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0
          };
          
          stats.sent = sentCount + failedCount;
          stats.delivered = sentCount;
          stats.failed = failedCount;
          
          await db.update(broadcasts)
            .set({
              stats: stats,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(broadcasts.id, broadcast.id));
        }
        
        // Wait before next batch if there are more
        if (i + BATCH_SIZE < contacts.length) {
          console.log(`⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // Mark broadcast as completed
      console.log(`\n🎉 BROADCAST COMPLETED: ${broadcast.id}`);
      console.log(`📊 Final stats: ${sentCount} sent, ${failedCount} failed`);
      
      await db.update(broadcasts)
        .set({
          status: 'sent',
          sentAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          stats: {
            total: contacts.length,
            sent: sentCount + failedCount,
            delivered: sentCount,
            read: 0,
            failed: failedCount
          },
          updatedAt: new Date().toISOString(),
        })
        .where(eq(broadcasts.id, broadcast.id));
      
      console.log(`✅ Broadcast ${broadcast.id} marked as 'sent'`);
      
    } catch (error: any) {
      console.error(`\n❌ ERROR in sendBroadcastMessages:`, error);
      console.error(`❌ Error stack:`, error.stack);
      
      // Mark broadcast as failed
      await db.update(broadcasts)
        .set({
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(broadcasts.id, broadcast.id));
      
      throw error;
    }
  }
  
  /**
   * Send individual broadcast message
   */
  private async sendBroadcastMessage(
    broadcast: any,
    user: any,
    contact: any
  ): Promise<any> {
    const db = getDb();
    let broadcastMessage;
    
    try {
      console.log(`\n📤 STARTING SEND TO ${contact.phone}`);
      console.log(`📊 Broadcast ID: ${broadcast.id}`);
      console.log(`👤 Contact: ${contact.name || contact.phone}`);
      
      // Find or create broadcast message record
      const [messageRecord] = await db.select()
        .from(broadcastMessages)
        .where(
          and(
            eq(broadcastMessages.broadcastId, broadcast.id),
            eq(broadcastMessages.contactId, contact.id)
          )
        )
        .limit(1);
      
      broadcastMessage = messageRecord;
      
      if (!broadcastMessage) {
        console.error('❌ Broadcast message record not found');
        throw new Error('Broadcast message record not found');
      }
      
      // Check if message already sent
      if (broadcastMessage.status === 'sent' || broadcastMessage.status === 'delivered') {
        console.log(`⚠️ Already sent to ${contact.phone}, skipping`);
        return { success: true, message: 'Already sent' };
      }
      
      // Update status to sending
      await db.update(broadcastMessages)
        .set({
          status: 'sending',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(broadcastMessages.id, broadcastMessage.id));
      
      let whatsappResponse;
      
      if (broadcast.templateId) {
        // Send template message
        const [template] = await db.select()
          .from(messageTemplates)
          .where(eq(messageTemplates.id, broadcast.templateId))
          .limit(1);
        
        if (!template) {
          console.error('❌ Template not found:', broadcast.templateId);
          throw new Error('Template not found');
        }
        
        console.log(`📄 Using template: ${template.name}`);
        console.log(`🌐 Template language: ${template.language}`);
        console.log(`🔤 Variables received:`, broadcast.variables);
        
        // Get the body component - safely access template.components
        const templateComponents = template.components as any[] || [];
        const bodyComponent = templateComponents.find((c: any) => c.type === 'BODY');
        const bodyText = bodyComponent?.text || '';
        console.log(`📝 Template body text: ${bodyText.substring(0, 100)}...`);
        
        // Check if template has media header
        const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
        const hasMediaHeader = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format);
        console.log(`🖼️ Has media header: ${hasMediaHeader}`);
        if (hasMediaHeader) {
          console.log(`📁 Media type: ${headerComponent.format}`);
          console.log(`🔗 Media URL: ${broadcast.mediaUrl || 'Not provided'}`);
        }
        
        // Prepare components array for WhatsApp API
        const components: any[] = [];
        const bodyVariables: any[] = [];
        
        // Get all variable keys and sort them if they're numeric
        const variableKeys = Object.keys(broadcast.variables || {});
        console.log(`🔑 Raw variable keys:`, variableKeys);
        
        const sortedKeys = variableKeys.sort((a, b) => {
          const aNum = parseInt(a);
          const bNum = parseInt(b);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.localeCompare(b);
        });

        console.log(`🔑 Sorted variable keys:`, sortedKeys);
        console.log(`📋 Variable values:`, sortedKeys.map(k => `${k}: ${broadcast.variables?.[k]}`));

        // Map sorted keys to values in correct order
        sortedKeys.forEach(key => {
          const variableValue = broadcast.variables?.[key] || '';
          bodyVariables.push({
            type: 'text',
            text: variableValue.toString()
          });
        });
        
        // Add body component if we have variables
        if (bodyVariables.length > 0) {
          components.push({
            type: 'body',
            parameters: bodyVariables
          });
          console.log(`✅ Added body component with ${bodyVariables.length} variables`);
        } else {
          console.log(`⚠️ No variables found for template body`);
        }
        
        // Add header if template has media
        if (hasMediaHeader && broadcast.mediaUrl) {
          const mediaType = headerComponent.format.toLowerCase();
          console.log(`📤 Adding media header: ${mediaType}`);
          
          let formatMap: Record<string, string> = {
            'IMAGE': 'image',
            'VIDEO': 'video', 
            'DOCUMENT': 'document'
          };
          
          const headerParam: any = {
            type: formatMap[headerComponent.format] || 'image'
          };
          
          if (mediaType === 'image') {
            headerParam.image = { link: broadcast.mediaUrl };
          } else if (mediaType === 'video') {
            headerParam.video = { link: broadcast.mediaUrl };
          } else if (mediaType === 'document') {
            headerParam.document = { 
              link: broadcast.mediaUrl, 
              filename: 'document' 
            };
          }
          
          components.push({
            type: 'header',
            parameters: [headerParam]
          });
        }
        
        console.log('📦 Final components for WhatsApp:', JSON.stringify(components, null, 2));
        
        // Check user credentials
        console.log(`🔐 User WhatsApp credentials:`, {
          phoneNumberId: user.whatsappPhoneNumberId?.substring(0, 10) + '...',
          hasToken: !!user.whatsappAccessToken,
          tokenLength: user.whatsappAccessToken?.length
        });
        
        if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
          console.error('❌ Missing WhatsApp credentials for user');
          throw new Error('WhatsApp not configured for user');
        }
        
        if (!contact.phone) {
          console.error('❌ Contact phone number is null or undefined');
          throw new Error('Contact phone number is required');
        }
        
        // Send template message using WhatsAppService
        console.log(`🚀 Calling WhatsAppService.sendTemplateMessage...`);
        console.log(`📞 To: ${contact.phone}`);
        console.log(`📋 Template: ${template.name}`);
        console.log(`🌐 Language: ${template.language}`);
        
        try {
          whatsappResponse = await WhatsAppService.sendTemplateMessage(
            user.whatsappPhoneNumberId,
            contact.phone,
            template.name,
            template.language||'en_US',
            components,
            user.whatsappAccessToken
          );
          
          console.log(`✅ WhatsApp API Success! Response:`, {
            hasMessages: !!whatsappResponse?.messages,
            messageCount: whatsappResponse?.messages?.length,
            firstMessageId: whatsappResponse?.messages?.[0]?.id
          });
          
        } catch (whatsappError: any) {
          console.error(`❌ WhatsApp API Error:`, {
            message: whatsappError.message,
            status: whatsappError.response?.status,
            data: whatsappError.response?.data,
            stack: whatsappError.stack
          });
          throw whatsappError;
        }
        
      } else {
        // Send regular text message
        console.log(`📤 Sending regular text message to ${contact.phone}`);
        console.log(`💬 Message: ${broadcast.message?.substring(0, 100)}...`);
        
        if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
          console.error('❌ Missing WhatsApp credentials for user');
          throw new Error('WhatsApp not configured for user');
        }
        
        if (!contact.phone) {
          console.error('❌ Contact phone number is null or undefined');
          throw new Error('Contact phone number is required');
        }
        
        try {
          whatsappResponse = await WhatsAppService.sendTextMessage(
            user.whatsappPhoneNumberId,
            contact.phone,
            broadcast.message || '',
            user.whatsappAccessToken
          );
          
          console.log(`✅ Text message sent successfully`);
          
        } catch (whatsappError: any) {
          console.error(`❌ WhatsApp API Error for text message:`, whatsappError.message);
          throw whatsappError;
        }
      }
      
      // Update broadcast message record
      const updateData: any = {
        status: 'sent',
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (whatsappResponse?.messages?.[0]?.id) {
        updateData.whatsappMessageId = whatsappResponse.messages[0].id;
        console.log(`✅ WhatsApp Message ID: ${whatsappResponse.messages[0].id}`);
      }
      
      await db.update(broadcastMessages)
        .set(updateData)
        .where(eq(broadcastMessages.id, broadcastMessage.id));
      
      // Update broadcast stats
      await this.updateBroadcastStats(broadcast.id, 'sent');
      
      console.log(`✅ Successfully sent to ${contact.phone}`);
      return whatsappResponse;
      
    } catch (error: any) {
      console.error(`\n❌ ERROR sending to ${contact?.phone || 'unknown'}:`, {
        message: error.message,
        stack: error.stack,
        contactPhone: contact?.phone,
        broadcastId: broadcast?.id
      });
      
      // Update broadcast message record with error
      const updateData: any = {
        status: 'failed',
        error: error.message,
        updatedAt: new Date().toISOString(),
      };
      
      if (broadcastMessage?.id) {
        await db.update(broadcastMessages)
          .set(updateData)
          .where(eq(broadcastMessages.id, broadcastMessage.id));
      }
      
      // Update broadcast stats
      await this.updateBroadcastStats(broadcast.id, 'failed');
      
      throw error;
    }
  }
  
  /**
   * Update broadcast statistics
   */
  private async updateBroadcastStats(broadcastId: string, status: 'sent' | 'delivered' | 'read' | 'failed'): Promise<void> {
    const db = getDb();
    
    try {
      // Get current stats
      const [broadcast] = await db.select()
        .from(broadcasts)
        .where(eq(broadcasts.id, broadcastId))
        .limit(1);
      
      if (!broadcast) return;
      
      // Cast stats to proper type
      const currentStats = broadcast.stats as BroadcastStats || {
        total: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
      };
      
      const stats: BroadcastStats = {
        total: currentStats.total,
        sent: currentStats.sent,
        delivered: currentStats.delivered,
        read: currentStats.read,
        failed: currentStats.failed
      };
      
      // Update appropriate counter
      switch (status) {
        case 'sent':
          stats.sent = (stats.sent || 0) + 1;
          break;
        case 'delivered':
          stats.delivered = (stats.delivered || 0) + 1;
          break;
        case 'read':
          stats.read = (stats.read || 0) + 1;
          break;
        case 'failed':
          stats.failed = (stats.failed || 0) + 1;
          break;
      }
      
      // Update broadcast
      await db.update(broadcasts)
        .set({
          stats: stats,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(broadcasts.id, broadcastId));
      
    } catch (error) {
      console.error('Error updating broadcast stats:', error);
    }
  }
  
  /**
   * Extract template variables from template components
   */
private extractTemplateVariables(template: any): string[] {
  const variables: string[] = [];
  
  const components = template.components as any[] || [];
  const bodyComponent = components.find((c: any) => c.type === 'BODY');
  
  if (!bodyComponent?.text) {
    return variables;
  }
  
  const bodyText = bodyComponent.text;
  
  // Check for structured named parameters
  if (bodyComponent.example?.body_text_named_params) {
    bodyComponent.example.body_text_named_params.forEach((param: any) => {
      variables.push(param.param_name);
    });
  }
  // Check for numbered parameters
  else if (bodyComponent.example?.body_text) {
    const positionGroups = bodyComponent.example.body_text;
    if (positionGroups && positionGroups.length > 0) {
      const exampleGroup = positionGroups[0];
      exampleGroup.forEach((example: string, index: number) => {
        variables.push(index.toString());
      });
    }
  }
  // Fallback to regex extraction
else {
  const pattern = /\{\{([^}]+)\}\}/g;
  const matchesResult = bodyText.match(pattern);
  
  if (matchesResult) {
    // Type the result as string[] when creating the Set
    const uniqueMatches = [...new Set<string>(matchesResult)];
    
    uniqueMatches.forEach(match => {
      const name = match.replace(/[{}]/g, '').trim();
      variables.push(name);
    });
  }
}
  
  return variables;
}

  /**
   * Update broadcast
   */
  async updateBroadcast(
    userId: string,
    broadcastId: string,
    data: UpdateBroadcastDto
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const db = getDb();
    
    try {
      // Check if broadcast exists and belongs to user
      const [broadcast] = await db.select()
        .from(broadcasts)
        .where(
          and(
            eq(broadcasts.id, broadcastId),
            eq(broadcasts.userId, userId)
          )
        )
        .limit(1);
      
      if (!broadcast) {
        return {
          success: false,
          error: 'Broadcast not found',
        };
      }
      
      // Only allow updates to certain fields based on status
      const allowedUpdates: any = {};
      
      if (data.name !== undefined) allowedUpdates.name = data.name;
      if (data.scheduledAt !== undefined) allowedUpdates.scheduledAt = data.scheduledAt.toISOString();
      
      // Status transitions
      if (data.status !== undefined) {
        // Validate status transition
        const validTransitions: Record<string, string[]> = {
          'draft': ['scheduled', 'sending'],
          'scheduled': ['sending', 'paused', 'draft'],
          'sending': ['paused', 'sent', 'failed'],
          'paused': ['sending', 'draft'],
          'sent': [],
          'failed': ['sending', 'draft'],
        };
        
        // Cast broadcast.status to string since it might be null
        const currentStatus = broadcast.status || 'draft';
        
        if (validTransitions[currentStatus]?.includes(data.status)) {
          allowedUpdates.status = data.status;
          
          // Handle status-specific actions
          if (data.status === 'sending') {
            // Start sending in background
            this.startBroadcast(broadcastId).catch(error => {
              console.error('Failed to start broadcast:', error);
            });
          }
        } else {
          return {
            success: false,
            error: `Invalid status transition from ${currentStatus} to ${data.status}`,
          };
        }
      }
      
      allowedUpdates.updatedAt = new Date().toISOString();
      
      const [updatedBroadcast] = await db.update(broadcasts)
        .set(allowedUpdates)
        .where(eq(broadcasts.id, broadcastId))
        .returning();
      
      return {
        success: true,
        data: updatedBroadcast,
      };
      
    } catch (error: any) {
      console.error('Error updating broadcast:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Delete broadcast
   */
  async deleteBroadcast(userId: string, broadcastId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const db = getDb();
    
    try {
      // Check if broadcast exists and belongs to user
      const [broadcast] = await db.select()
        .from(broadcasts)
        .where(
          and(
            eq(broadcasts.id, broadcastId),
            eq(broadcasts.userId, userId)
          )
        )
        .limit(1);
      
      if (!broadcast) {
        return {
          success: false,
          error: 'Broadcast not found',
        };
      }
      
      // Don't allow deletion of active broadcasts
      if (broadcast.status === 'sending') {
        return {
          success: false,
          error: 'Cannot delete a broadcast that is currently sending',
        };
      }
      
      // Delete broadcast (cascade will delete broadcast_messages)
      await db.delete(broadcasts)
        .where(eq(broadcasts.id, broadcastId));
      
      return { 
        success: true, 
        message: 'Broadcast deleted successfully' 
      };
      
    } catch (error: any) {
      console.error('Error deleting broadcast:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const db = getDb();
    
    try {
      // Get total broadcasts count
      const totalResult = await db.select({ count: sql<number>`count(*)` })
        .from(broadcasts)
        .where(eq(broadcasts.userId, userId));
      
      const total = totalResult.length > 0 ? Number(totalResult[0]?.count || 0) : 0;
      
      // Get counts by status
      const statusCounts = await db.select({
        status: broadcasts.status,
        count: sql<number>`count(*)`,
      })
        .from(broadcasts)
        .where(eq(broadcasts.userId, userId))
        .groupBy(broadcasts.status);
      
      // Get recent broadcasts
      const recentBroadcasts = await db.select()
        .from(broadcasts)
        .where(eq(broadcasts.userId, userId))
        .orderBy(desc(broadcasts.createdAt))
        .limit(5);
      
      return {
        success: true,
        data: {
          total,
          byStatus: statusCounts,
          recent: recentBroadcasts,
        },
      };
      
    } catch (error: any) {
      console.error('Error getting broadcast stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const broadcastService = new BroadcastService();