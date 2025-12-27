// backend/src/services/automation-execution.service.ts
import { db, getDb } from '../db/client';
import { automations, automationRuns, contacts, users, conversations } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { WhatsAppService } from './whatsapp.service';
import { VariableService } from './variable.service';
import { messageService } from './message/message.service';
import { sql } from 'drizzle-orm';

export interface ExecutionContext {
  contactId: string;
  workflowId: string;
  executionId: string;
  currentData: Record<string, any>;
  userData?: any;
}

export class AutomationExecutionService {
  /**
   * Execute an automation workflow for a specific contact
   */
  async executeWorkflow(
    automationId: string,
    contactId: string,
    userId: string,
    triggerData: any
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      console.log(`[Automation] Starting execution for workflow ${automationId}, contact ${contactId}`);
      
      const db = getDb();
      
      // 1. Get the automation
      const automationResult = await db.select({
        id: automations.id,
        name: automations.name,
        flowData: automations.flowData
      })
      .from(automations)
      .where(eq(automations.id, automationId))
      .limit(1);
      
      if (automationResult.length === 0) {
        return { success: false, error: 'Automation not found' };
      }
      
      const automation = automationResult[0];
      const flowData = automation.flowData as any;
      
      // 2. Get user's WhatsApp config
      const userResult = await db.select({
        id: users.id,
        email: users.email,
        whatsappPhoneNumberId: users.whatsappPhoneNumberId,
        whatsappAccessToken: users.whatsappAccessToken,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
      if (userResult.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      const user = userResult[0];
      
      if (!user.whatsappPhoneNumberId || !user.whatsappAccessToken) {
        return { success: false, error: 'WhatsApp not configured for user' };
      }
      
      // 3. Get contact
      const contactResult = await db.select({ 
        id: contacts.id,
        phone: contacts.phone,
        name: contacts.name,
        email: contacts.email
      })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
      
      if (contactResult.length === 0) {
        return { success: false, error: 'Contact not found' };
      }
      
      const contact = contactResult[0];
      
      // 4. Get conversation from trigger data
      let conversationId = triggerData.metadata?.conversation_id;
      let conversation = null;
      
      if (conversationId) {
        const conversationResult = await db.select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);
        
        if (conversationResult.length > 0) {
          conversation = conversationResult[0];
          console.log(`[Automation] Using existing conversation: ${conversation.id}`);
        }
      }
      
      // If no conversation found, messageService will create one
      
      // 5. Execute workflow from flow_data
      if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
        console.log('[Automation] No nodes found in flow data');
        return { success: false, error: 'Invalid flow data structure' };
      }
      
      // Find all message nodes
      const textMessageNodes = flowData.nodes.filter((node: any) => node.type === 'textMessageNode');
      
      console.log(`[Automation] Found ${textMessageNodes.length} message nodes`);
      
      if (textMessageNodes.length === 0) {
        console.log('[Automation] No message nodes found in workflow');
        return { success: false, error: 'No message nodes in workflow' };
      }
      
      // Process each message node
      for (const node of textMessageNodes) {
        const nodeData = node.data || {};
        let message = nodeData.message || '';
        
        console.log(`[Automation] Processing message node: ${node.id}`);
        console.log(`[Automation] Original message: ${message}`);
        
        // Replace variables in message using VariableService
        if (message.includes('{{')) {
          const allVariables = VariableService.getAvailableVariables(
            conversation || { id: 'temp', status: 'active', unreadCount: 0 },
            contact,
            user
          );
          
          message = VariableService.replaceVariables(message, allVariables);
          console.log(`[Automation] Personalized message: ${message}`);
        }
        
        if (message && message.trim()) {
          console.log(`[Automation] Sending message: ${message}`);
          
          try {
            // Use unified MessageService to send message
            await messageService.sendMessage({
              contactId: contact.id,
              userId: user.id,
              conversationId: conversation?.id,
              body: message,
              direction: 'outgoing',
              messageType: 'text',
              metadata: {
                automation: true,
                automationId: automation.id,
                automationName: automation.name,
                nodeId: node.id,
                triggerMessageId: triggerData.metadata?.saved_message_id,
              },
            });
            
            console.log(`[Automation] ✅ Message sent successfully`);
            
          } catch (error: any) {
            console.error('[Automation] ❌ Error sending message:', error);
            
            // Save failed attempt using MessageService
            await messageService.saveMessage({
              conversationId: conversation?.id || 'temp',
              contactId: contact.id,
              direction: 'outgoing',
              messageType: 'text',
              body: message,
              status: 'failed',
              metadata: {
                automation: true,
                automationId: automation.id,
                error: error.message,
                nodeId: node.id,
              },
            });
          }
        } else {
          console.log('[Automation] Skipping empty message');
        }
      }
      
      // 6. Update automation stats
      try {
        await db.update(automations)
          .set({
            totalRuns: sql`${automations.totalRuns} + 1`,
            successfulRuns: sql`${automations.successfulRuns} + 1`,
            lastRunAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(automations.id, automationId));
      } catch (error) {
        console.warn('[Automation] Could not update automation stats:', error);
      }
      
      // 7. Log execution
      const executionId = `exec-${Date.now()}`;
      console.log(`[Automation] ✅ Execution completed: ${executionId}`);
      
      return { success: true, executionId };
      
    } catch (error: any) {
      console.error('[Automation] ❌ Execution failed:', error);
      
      // Update failed runs count
      try {
        const db = getDb();
        await db.update(automations)
          .set({
            totalRuns: sql`${automations.totalRuns} + 1`,
            failedRuns: sql`${automations.failedRuns} + 1`,
            lastRunAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(automations.id, automationId));
      } catch (updateError) {
        console.warn('[Automation] Could not update failed stats:', updateError);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Manually trigger an automation for a contact
   */
  async triggerAutomation(automationId: string, contactId: string, userId: string, triggerData?: any) {
    return this.executeWorkflow(automationId, contactId, userId, triggerData);
  }

  /**
   * Get execution runs for an automation
   */
  async getAutomationRuns(automationId: string, userId: string, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      // Verify automation belongs to user
      const [automation] = await db
        .select()
        .from(automations)
        .where(and(
          eq(automations.id, automationId),
          eq(automations.userId, userId)
        ));

      if (!automation) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      const runs = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.createdAt))
        .limit(limit)
        .offset(offset);

      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId));

      return {
        success: true,
        data: runs,
        pagination: {
          page,
          limit,
          total: total[0]?.count || 0,
          pages: Math.ceil((total[0]?.count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching automation runs:', error);
      return {
        success: false,
        error: 'Failed to fetch automation runs',
      };
    }
  }
}

export const automationExecutionService = new AutomationExecutionService();