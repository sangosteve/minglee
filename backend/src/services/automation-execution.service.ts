// backend/src/services/automation-execution.service.ts
import { db, getDb } from '../db/client';
import { automations, automationRuns, contacts, users, messages, conversations } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { WhatsAppService } from './whatsapp.service';
import { VariableService } from './variable.service'; // Add this import

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
  triggerData: any  // Now includes conversation_id
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  try {
    console.log(`[Automation] Starting execution for workflow ${automationId}, contact ${contactId}`);
    console.log(`[Automation] Trigger data:`, JSON.stringify(triggerData, null, 2));
    
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
      whatsappBusinessId: users.whatsappBusinessId
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
    
    // 4. Get conversation from trigger data OR find existing one
    let conversationId = triggerData.metadata?.conversation_id;
    let conversation;
    
    if (conversationId) {
      // Use the conversation ID from trigger data
      const conversationResult = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (conversationResult.length > 0) {
        conversation = conversationResult[0];
        console.log(`[Automation] Using existing conversation: ${conversation.id}`);
      } else {
        console.warn(`[Automation] Conversation ${conversationId} not found, will find/create one`);
        conversationId = null;
      }
    }
    
    // If no conversation ID provided or not found, find/create one
    if (!conversation) {
      const conversationResult = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.contactId, contactId),
          eq(conversations.whatsappPhoneNumberId, user.whatsappPhoneNumberId),
          eq(conversations.userId, userId)
        ))
        .limit(1);
      
      if (conversationResult.length > 0) {
        conversation = conversationResult[0];
        console.log(`[Automation] Found existing conversation: ${conversation.id}`);
      } else {
        // This should rarely happen, but create if needed
        console.log(`[Automation] Creating new conversation for contact ${contactId}`);
        const [newConversation] = await db.insert(conversations).values({
          contactId,
          userId,
          whatsappPhoneNumberId: user.whatsappPhoneNumberId,
          lastMessage: 'Automated message',
          lastMessageAt: new Date(),
          unreadCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        conversation = newConversation;
        console.log(`[Automation] Created conversation: ${conversation.id}`);
      }
    }
    
    // 5. Execute workflow from flow_data
    if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
      console.log('[Automation] No nodes found in flow data');
      return { success: false, error: 'Invalid flow data structure' };
    }
    
    // Find all message nodes
    const messageNodes = flowData.nodes.filter((node: any) => node.type === 'messageNode');
    
    console.log(`[Automation] Found ${messageNodes.length} message nodes`);
    
    if (messageNodes.length === 0) {
      console.log('[Automation] No message nodes found in workflow');
      return { success: false, error: 'No message nodes in workflow' };
    }
    
    // Process each message node
    for (const node of messageNodes) {
      const nodeData = node.data || {};
      let message = nodeData.message || '';
      
      console.log(`[Automation] Processing message node: ${node.id}`);
      console.log(`[Automation] Original message: ${message}`);
      
      // Replace variables in message
      if (message.includes('{{')) {
        // Replace contact.name variable
        if (message.includes('{{contact.name}}')) {
          const contactName = contact.name || 'there';
          message = message.replace(/{{contact.name}}/g, contactName);
          console.log(`[Automation] Replaced contact.name with: ${contactName}`);
        }
        
        // Add more variable replacements as needed
        if (message.includes('{{contact.phone}}')) {
          message = message.replace(/{{contact.phone}}/g, contact.phone);
        }
      }
      
      if (message && message.trim()) {
        console.log(`[Automation] Sending message: ${message}`);
        
        try {
          // Send via WhatsApp API
          const whatsappResult = await WhatsAppService.sendTextMessage(
            user.whatsappPhoneNumberId!,
            contact.phone,
            message,
            user.whatsappAccessToken!
          );
          
          const whatsappMessageId = whatsappResult.messages?.[0]?.id;
          console.log(`[Automation] WhatsApp message sent: ${whatsappMessageId}`);
          
          // Save to database
          const [savedMessage] = await db.insert(messages).values({
            conversationId: conversation.id,
            contactId: contact.id,
            whatsappMessageId: whatsappMessageId || `auto-${Date.now()}`,
            direction: 'outgoing',
            messageType: 'text',
            body: message,
            status: 'sent',
            timestamp: new Date(),
            metadata: {
              type: 'text',
              text: { body: message },
              automation: true,
              automationId: automation.id,
              automationName: automation.name,
              nodeId: node.id,
              triggerMessageId: triggerData.metadata?.saved_message_id,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          
          console.log(`[Automation] ✅ Message saved: ${savedMessage.id}`);
          
          // Update conversation
          await db.update(conversations)
            .set({
              lastMessage: message,
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversation.id));
          
        } catch (error: any) {
          console.error('[Automation] ❌ Error sending message:', error);
          
          // Save failed attempt
          await db.insert(messages).values({
            conversationId: conversation.id,
            contactId: contact.id,
            whatsappMessageId: `failed-auto-${Date.now()}`,
            direction: 'outgoing',
            messageType: 'text',
            body: message,
            status: 'failed',
            timestamp: new Date(),
            metadata: {
              type: 'text',
              text: { body: message },
              automation: true,
              automationId: automation.id,
              error: error.message,
              nodeId: node.id,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
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
   * Execute a specific node in the workflow
   */
  private async executeNode(workflow: any, contact: any, context: ExecutionContext, nodeId: string) {
    const flowData = workflow.flowData || workflow.flow_data;
    const node = flowData?.nodes?.find((n: any) => n.id === nodeId);
    
    if (!node) {
      console.log(`[Automation] Node not found: ${nodeId} - reached end of flow`);
      return;
    }

    console.log(`[Automation ${context.executionId}] Executing node: ${node.type} (${node.id})`);

    try {
      // Execute based on node type
      switch (node.type) {
        case 'startNode':
          await this.executeStartNode(node, context);
          break;
        case 'messageNode':
          await this.executeMessageNode(node, contact, context);
          break;
        // TODO: Add other node types here as you implement them
        // case 'conditionNode':
        // case 'delayNode':
        // case 'tagNode':
        default:
          console.warn(`[Automation] Unknown node type: ${node.type}`);
      }

      // Find next nodes and execute them
      const nextEdges = flowData?.edges?.filter((edge: any) => edge.source === nodeId) || [];
      
      if (nextEdges.length === 0) {
        console.log(`[Automation ${context.executionId}] No more nodes to execute`);
        return;
      }

      for (const edge of nextEdges) {
        await this.executeNode(workflow, contact, context, edge.target);
      }

    } catch (error) {
      console.error(`[Automation] Node execution failed: ${node.id}`, error);
      throw error;
    }
  }

  /**
   * Execute start node
   */
  private async executeStartNode(node: any, context: ExecutionContext) {
    console.log(`[Automation ${context.executionId}] Starting workflow`);
    // Start node doesn't do anything, just continues to next nodes
  }

  /**
   * Execute message node - send a WhatsApp message
   */
  private async executeMessageNode(node: any, contact: any, context: ExecutionContext) {
    let messageTemplate = node.data?.message;
    
    if (!messageTemplate?.trim()) {
      throw new Error('Message content is empty');
    }

    console.log(`[Automation ${context.executionId}] Processing message node:`, {
      originalTemplate: messageTemplate,
      contactId: contact.id,
      contactName: contact.name
    });

    // ============ VARIABLE REPLACEMENT USING VariableService ============
    // Get all available variables for this context
    const allVariables = VariableService.getAvailableVariables(
      { 
        id: context.executionId, 
        status: 'active', 
        unreadCount: 0 
      }, // conversation context
      contact, // contact data
      context.userData // user data
    );

    console.log(`[Automation] Available variables for contact ${contact.id}:`, {
      'contact.name': allVariables['contact.name'],
      'contact.phone': allVariables['contact.phone'],
      'contact.email': allVariables['contact.email'],
      variableCount: Object.keys(allVariables).length
    });

    // Replace variables using the actual VariableService
    const personalizedMessage = VariableService.replaceVariables(messageTemplate, allVariables);
    
    console.log(`[Automation ${context.executionId}] Personalized message:`, {
      before: messageTemplate,
      after: personalizedMessage
    });

    // Debug: Check if variables were replaced
    const remainingVariables = VariableService.extractVariables(personalizedMessage);
    if (remainingVariables.length > 0) {
      console.warn(`⚠️ Some variables were not replaced:`, remainingVariables);
    }
    // ============ END VARIABLE REPLACEMENT ============

    // Check if user has WhatsApp credentials
    if (!context.userData.whatsappAccessToken || !context.userData.whatsappPhoneNumberId) {
      throw new Error('User does not have WhatsApp credentials configured');
    }

    // Get or create conversation
    const conversationId = await this.getOrCreateConversation(contact.id, context.userData.id);

    // Send personalized message via WhatsApp API
    await this.sendWhatsAppMessage(
      contact.phone,
      personalizedMessage, // This now has replaced variables
      conversationId,
      context.userData.whatsappPhoneNumberId,
      context.userData.whatsappAccessToken
    );

    console.log(`[Automation ${context.executionId}] Personalized message sent successfully`);
  }

  /**
   * Get or create a conversation for the contact
   */
  private async getOrCreateConversation(contactId: string, userId: string): Promise<string> {
    // Check if conversation exists
    const [existingConversation] = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.contactId, contactId),
        eq(conversations.userId, userId)
      ))
      .limit(1);

    if (existingConversation) {
      // Update last message time
      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(conversations.id, existingConversation.id));
      
      return existingConversation.id;
    }

    // Create new conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        contactId,
        userId,
        status: 'active',
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return newConversation.id;
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsAppMessage(
    to: string, 
    message: string, 
    conversationId: string,
    phoneNumberId: string,
    accessToken: string
  ) {
    try {
      // Ensure phone number has + prefix
      const formattedTo = to.startsWith('+') ? to : `+${to}`;
      
      console.log(`[WhatsApp] Sending personalized message to ${formattedTo}:`, message);

      // Send via WhatsApp API
      const result = await WhatsAppService.sendTextMessage(
        phoneNumberId,
        formattedTo,
        message,
        accessToken
      );

      if (!result?.messages?.[0]?.id) {
        throw new Error('WhatsApp API did not return a message ID');
      }

      // Record the message in database
      const [sentMessage] = await db
        .insert(messages)
        .values({
          contactId: conversationId,
          conversationId,
          direction: 'outgoing',
          messageType: 'text',
          body: message,
          status: 'sent',
          whatsappMessageId: result.messages[0].id,
          timestamp: new Date(),
          createdAt: new Date()
        })
        .returning();

      console.log(`[WhatsApp] Personalized message sent successfully: ${sentMessage.id}`);
      return sentMessage;

    } catch (error) {
      console.error('[WhatsApp] Failed to send message:', error);
      throw new Error(`Failed to send WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  /**
   * Test variable service integration
   */
  async testVariableReplacement(contactId: string, userId: string, template: string) {
    try {
      // Get contact data
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, contactId));

      if (!contact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      // Get user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Get all available variables
      const allVariables = VariableService.getAvailableVariables(
        { id: 'test', status: 'active', unreadCount: 0 },
        contact,
        user
      );

      // Replace variables
      const personalized = VariableService.replaceVariables(template, allVariables);

      return {
        success: true,
        data: {
          original: template,
          personalized: personalized,
          variables: allVariables,
          contact: {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            city: contact.city,
            country: contact.country
          }
        }
      };

    } catch (error) {
      console.error('Error testing variable replacement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const automationExecutionService = new AutomationExecutionService();

// Need to import sql
import { sql } from 'drizzle-orm';