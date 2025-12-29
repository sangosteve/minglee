// backend/src/services/automation-execution.service.ts
import { getDb } from '../db/client';
import { 
  automations, 
  automationRuns, 
  contacts, 
  users, 
  conversations, 
  tags 
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { VariableService } from './variable.service';
import { messageService } from './message/message.service';

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
    triggerData: any = {}
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    const db = getDb();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[Automation] 🚀 Starting execution ${executionId}`);
      console.log(`[Automation] Automation: ${automationId}, Contact: ${contactId}, User: ${userId}`);
      
      // 1. Get automation with flow data
      const [automation] = await db.select({
        id: automations.id,
        name: automations.name,
        flowData: automations.flowData,
        userId: automations.userId
      })
      .from(automations)
      .where(eq(automations.id, automationId))
      .limit(1);
      
      if (!automation) {
        console.error(`[Automation] ❌ Automation not found: ${automationId}`);
        return { success: false, error: 'Automation not found' };
      }
      
      // Verify ownership
      if (automation.userId !== userId) {
        console.error(`[Automation] ❌ Unauthorized access to automation`);
        return { success: false, error: 'Unauthorized' };
      }
      
      // 2. Get user
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        whatsappPhoneNumberId: users.whatsappPhoneNumberId,
        whatsappAccessToken: users.whatsappAccessToken,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
      if (!user) {
        console.error(`[Automation] ❌ User not found: ${userId}`);
        return { success: false, error: 'User not found' };
      }
      
      // 3. Get contact
      const [contact] = await db.select({ 
        id: contacts.id,
        phone: contacts.phone,
        name: contacts.name,
        email: contacts.email,
        tagIds: contacts.tagIds
      })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
      
      if (!contact) {
        console.error(`[Automation] ❌ Contact not found: ${contactId}`);
        return { success: false, error: 'Contact not found' };
      }
      
      // 4. Get conversation
      let conversation = null;
      if (triggerData?.metadata?.conversation_id) {
        const [convo] = await db.select()
          .from(conversations)
          .where(eq(conversations.id, triggerData.metadata.conversation_id))
          .limit(1);
        
        conversation = convo;
      }
      
      // 5. Create execution context
      const context: ExecutionContext = {
        contactId: contact.id,
        workflowId: automation.id,
        executionId,
        currentData: {
          contact,
          user,
          conversation,
          triggerData,
          variables: {}
        },
        userData: user
      };
      
      // 6. Execute flow data
      const flowData = automation.flowData as any;
      if (!flowData?.nodes || !Array.isArray(flowData.nodes)) {
        console.error(`[Automation] ❌ Invalid flow data`);
        return { success: false, error: 'Invalid flow data' };
      }
      
      console.log(`[Automation] Processing ${flowData.nodes.length} nodes`);
      
      // Sort nodes by position
      const sortedNodes = this.sortNodesByPosition(flowData.nodes);
      
      // Track execution results
      const nodeExecutions: any[] = [];
      
      // Process each node
      for (const node of sortedNodes) {
        console.log(`[Automation] ➡️ Processing node: ${node.id} (${node.type})`);
        
        const nodeStartTime = Date.now();
        let nodeSuccess = false;
        let nodeError = null;
        
        try {
          switch (node.type) {
            case 'textMessageNode':
              await this.executeTextMessageNode(node, context);
              nodeSuccess = true;
              break;
              
            case 'tagNode':
              await this.executeTagNode(node, context);
              nodeSuccess = true;
              break;
              
            case 'delayNode':
              await this.executeDelayNode(node, context);
              nodeSuccess = true;
              break;
              
            case 'conditionNode':
              const conditionResult = await this.executeConditionNode(node, context);
              nodeSuccess = conditionResult.success;
              break;
              
            default:
              console.log(`[Automation] ⚠️ Unknown node type: ${node.type}`);
              nodeSuccess = true; // Continue with other nodes
          }
        } catch (error: any) {
          nodeError = error.message;
          console.error(`[Automation] ❌ Error in node ${node.id}:`, error);
        }
        
        nodeExecutions.push({
          nodeId: node.id,
          nodeType: node.type,
          success: nodeSuccess,
          error: nodeError,
          duration: Date.now() - nodeStartTime,
          timestamp: new Date()
        });
      }
      
      // 7. Update automation stats
      const allNodesSuccessful = nodeExecutions.every(exec => exec.success);
      await this.updateAutomationStats(automationId, allNodesSuccessful);
      
      // 8. Save execution record
      await this.saveExecutionRecord({
        automationId,
        contactId,
        userId,
        status: allNodesSuccessful ? 'completed' : 'partial_failure',
        triggerData,
        nodeExecutions,
        executionData: context,
        startedAt: new Date(),
        completedAt: new Date(),
      });
      
      console.log(`[Automation] ✅ Execution completed: ${executionId}`);
      return { success: true, executionId };
      
    } catch (error: any) {
      console.error(`[Automation] ❌ Execution failed:`, error);
      
      // Save failed execution
      try {
        await this.saveExecutionRecord({
          automationId,
          contactId,
          userId,
          status: 'failed',
          triggerData,
          nodeExecutions: [],
          error: error.message,
          startedAt: new Date(),
          completedAt: new Date(),
        });
      } catch (saveError) {
        console.error('[Automation] Failed to save error record:', saveError);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute tag node
   */
// backend/src/services/automation-execution.service.ts
// Add this method to your existing AutomationExecutionService class

/**
 * Execute tag node - COMPLETE VERSION
 */
// Update the executeTagNode method in AutomationExecutionService.ts

/**
 * Execute tag node - FIXED array handling
 */
private async executeTagNode(node: any, context: ExecutionContext): Promise<void> {
  const db = getDb();
  const nodeData = node.data || {};
  const action = nodeData.action || 'add';
  const nodeLabel = nodeData.label || 'Tag Node';
  
  // GET BOTH IDs and Names
  let tagIds = nodeData.tagIds || [];
  let tagNames = nodeData.tagNames || [];
  
  console.log(`[Automation] 🏷️ Tag node "${nodeLabel}": ${action} action`);
  console.log(`[Automation] Received tagIds:`, tagIds);
  console.log(`[Automation] Received tagNames:`, tagNames);
  
  // Get user and contact info
  const userId = context.userData.id;
  const contactId = context.contactId;
  
  console.log(`[Automation] User ID: ${userId}, Contact ID: ${contactId}`);
  
  // If we have names but no IDs, try to look up IDs
  if (tagNames.length > 0 && tagIds.length === 0) {
    console.log(`[Automation] ⚠️ No tag IDs found, looking up by names...`);
    
    const foundTagIds: string[] = [];
    
    for (const tagName of tagNames) {
      try {
        console.log(`[Automation] Looking for tag: "${tagName}"`);
        
        // Check if tag already exists for this user
        const existingTags = await db.select()
          .from(tags)
          .where(
            and(
              eq(tags.name, tagName),
              eq(tags.userId, userId)
            )
          )
          .limit(1);
        
        if (existingTags.length > 0) {
          foundTagIds.push(existingTags[0].id);
          console.log(`[Automation] Found existing tag "${tagName}": ${existingTags[0].id}`);
        } else {
          // Create new tag
          console.log(`[Automation] Creating new tag "${tagName}"...`);
          const [newTag] = await db.insert(tags).values({
            name: tagName,
            color: this.generateRandomColor(),
            userId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          
          foundTagIds.push(newTag.id);
          console.log(`[Automation] ✅ Created new tag "${tagName}": ${newTag.id}`);
        }
      } catch (error: any) {
        console.error(`[Automation] ❌ Error processing tag "${tagName}":`, error.message);
        
        // If it's a duplicate, try to find it again
        if (error.code === '23505' || error.message?.includes('unique constraint')) {
          console.log(`[Automation] Tag "${tagName}" already exists, trying to find it...`);
          
          const [duplicateTag] = await db.select()
            .from(tags)
            .where(
              and(
                eq(tags.name, tagName),
                eq(tags.userId, userId)
              )
            )
            .limit(1);
          
          if (duplicateTag) {
            foundTagIds.push(duplicateTag.id);
            console.log(`[Automation] Found duplicate tag: ${duplicateTag.id}`);
          }
        }
      }
    }
    
    tagIds = foundTagIds;
    console.log(`[Automation] Final tagIds after lookup:`, tagIds);
  }
  
  // Filter out temporary IDs (if any)
  const validTagIds = tagIds.filter((id: string) => !id.startsWith('temp-'));
  const temporaryTagNames = tagNames.filter((_: any, index: number) => 
    tagIds[index] && tagIds[index].startsWith('temp-')
  );
  
  console.log(`[Automation] Valid tag IDs:`, validTagIds);
  console.log(`[Automation] Temporary tag names to create:`, temporaryTagNames);
  
  // Create temporary tags that don't exist yet
  if (temporaryTagNames.length > 0) {
    console.log(`[Automation] Creating ${temporaryTagNames.length} temporary tags...`);
    
    for (const tagName of temporaryTagNames) {
      try {
        // Check if tag already exists
        const [existingTag] = await db.select()
          .from(tags)
          .where(
            and(
              eq(tags.name, tagName),
              eq(tags.userId, userId)
            )
          )
          .limit(1);
        
        if (existingTag) {
          validTagIds.push(existingTag.id);
          console.log(`[Automation] Temporary tag "${tagName}" already exists: ${existingTag.id}`);
        } else {
          // Create new tag
          const [newTag] = await db.insert(tags).values({
            name: tagName,
            color: this.generateRandomColor(),
            userId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          
          validTagIds.push(newTag.id);
          console.log(`[Automation] ✅ Created temporary tag "${tagName}": ${newTag.id}`);
        }
      } catch (error: any) {
        console.error(`[Automation] ❌ Failed to create tag "${tagName}":`, error.message);
        
        // If duplicate, find it
        if (error.code === '23505' || error.message?.includes('unique constraint')) {
          const [duplicateTag] = await db.select()
            .from(tags)
            .where(
              and(
                eq(tags.name, tagName),
                eq(tags.userId, userId)
              )
            )
            .limit(1);
          
          if (duplicateTag) {
            validTagIds.push(duplicateTag.id);
            console.log(`[Automation] Found duplicate temporary tag: ${duplicateTag.id}`);
          }
        }
      }
    }
  }
  
  console.log(`[Automation] Final valid tag IDs to process:`, validTagIds);
  
  if (validTagIds.length === 0) {
    console.log('[Automation] ⚠️ No valid tags to process, skipping');
    return;
  }
  
  // FIX: Use proper array handling for the ANY operator
  // Option 1: Convert to array literal format that PostgreSQL understands
  const arrayLiteral = `{${validTagIds.map(id => `"${id}"`).join(',')}}`;
  
  console.log(`[Automation] Array literal: ${arrayLiteral}`);
  
  // Verify all tag IDs belong to the user using array contains operator
  let userTags;
  
  // Option 1A: Using array contains with proper formatting
  try {
    userTags = await db.select()
      .from(tags)
      .where(
        and(
          eq(tags.userId, userId),
          sql`${tags.id} = ANY(ARRAY[${sql.join(validTagIds.map(id => sql`${id}`), sql`, `)}]::uuid[])`
        )
      );
  } catch (error) {
    console.warn('[Automation] Array method 1 failed, trying alternative...');
    
    // Option 1B: Alternative method - simpler query
    userTags = await db.select()
      .from(tags)
      .where(
        and(
          eq(tags.userId, userId),
          sql`${tags.id} IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`, `)})`
        )
      );
  }
  
  const verifiedTagIds = userTags.map(tag => tag.id);
  
  if (verifiedTagIds.length !== validTagIds.length) {
    const missingIds = validTagIds.filter((id: string) => !verifiedTagIds.includes(id));
    console.warn(`[Automation] ⚠️ Some tags not found for user:`, missingIds);
    
    // If some tags are missing, we'll only process the ones we found
    console.log(`[Automation] Will process only ${verifiedTagIds.length} verified tags`);
  }
  
  if (verifiedTagIds.length === 0) {
    console.log('[Automation] ⚠️ No verified tags to process, skipping');
    return;
  }
  
  // Get current contact with tags
  const [contact] = await db.select({
    id: contacts.id,
    name: contacts.name,
    phone: contacts.phone,
    tagIds: contacts.tagIds,
  })
  .from(contacts)
  .where(eq(contacts.id, contactId))
  .limit(1);
  
  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  
  console.log(`[Automation] Contact: ${contact.name} (${contact.phone})`);
  console.log(`[Automation] Current contact tag IDs:`, contact.tagIds || []);
  
  // Get tag names for logging
  const tagNameMap = new Map();
  for (const tag of userTags) {
    tagNameMap.set(tag.id, tag.name);
  }
  
  const currentTagNames = (contact.tagIds || [])
    .map(id => tagNameMap.get(id) || `Unknown(${id})`)
    .filter(name => name);
  
  console.log(`[Automation] Current contact tag names:`, currentTagNames);
  
  const currentTagIds = contact.tagIds || [];
  let newTagIds = [...currentTagIds];
  
  // Count before changes for logging
  const beforeCount = newTagIds.length;
  
  // Apply action
  switch (action) {
    case 'add':
      // Add tags, avoid duplicates
      const addedTags: string[] = [];
      verifiedTagIds.forEach((tagId: string) => {
        if (!newTagIds.includes(tagId)) {
          newTagIds.push(tagId);
          addedTags.push(tagNameMap.get(tagId) || `Tag(${tagId})`);
        }
      });
      
      if (addedTags.length > 0) {
        console.log(`[Automation] ➕ Adding ${addedTags.length} tags:`, addedTags);
      } else {
        console.log(`[Automation] ℹ️ No new tags to add (all already present)`);
      }
      break;
      
    case 'remove':
      // Remove specified tags
      const beforeRemove = newTagIds.length;
      const removedTags: string[] = [];
      
      newTagIds = newTagIds.filter(tagId => {
        if (verifiedTagIds.includes(tagId)) {
          removedTags.push(tagNameMap.get(tagId) || `Tag(${tagId})`);
          return false;
        }
        return true;
      });
      
      if (removedTags.length > 0) {
        console.log(`[Automation] ➖ Removing ${removedTags.length} tags:`, removedTags);
      } else {
        console.log(`[Automation] ℹ️ No tags to remove (none of the specified tags were present)`);
      }
      break;
      
    case 'toggle':
      // Toggle tags: add if not present, remove if present
      const toggledAdded: string[] = [];
      const toggledRemoved: string[] = [];
      
      verifiedTagIds.forEach((tagId: string) => {
        const tagName = tagNameMap.get(tagId) || `Tag(${tagId})`;
        const index = newTagIds.indexOf(tagId);
        
        if (index > -1) {
          // Remove if present
          newTagIds.splice(index, 1);
          toggledRemoved.push(tagName);
          console.log(`[Automation] 🔄 Toggling OFF: ${tagName}`);
        } else {
          // Add if not present
          newTagIds.push(tagId);
          toggledAdded.push(tagName);
          console.log(`[Automation] 🔄 Toggling ON: ${tagName}`);
        }
      });
      
      console.log(`[Automation] 🔄 Toggle result: +${toggledAdded.length}, -${toggledRemoved.length}`);
      if (toggledAdded.length > 0) console.log(`Added:`, toggledAdded);
      if (toggledRemoved.length > 0) console.log(`Removed:`, toggledRemoved);
      break;
      
    default:
      console.error(`[Automation] ❌ Unknown action: ${action}`);
      throw new Error(`Unknown tag action: ${action}`);
  }
  
  const afterCount = newTagIds.length;
  const changeCount = afterCount - beforeCount;
  
  console.log(`[Automation] Tag count: ${beforeCount} → ${afterCount} (${changeCount > 0 ? '+' : ''}${changeCount})`);
  
  // Check if tags actually changed
  const tagsChanged = JSON.stringify(currentTagIds.sort()) !== JSON.stringify(newTagIds.sort());
  
  if (!tagsChanged) {
    console.log(`[Automation] ℹ️ No changes to contact tags`);
    return;
  }
  
  // Update contact in database
  console.log(`[Automation] Updating contact ${contactId} with ${newTagIds.length} tags...`);
  
  await db.update(contacts)
    .set({
      tagIds: newTagIds,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));
  
  console.log(`[Automation] ✅ Contact tags updated successfully`);
  
  // Get updated tag names for logging
  const updatedTagNames = newTagIds
    .map(id => tagNameMap.get(id) || `Unknown(${id})`)
    .filter(name => name);
  
  console.log(`[Automation] New contact tag names:`, updatedTagNames);
  
  // Update context for subsequent nodes
  context.currentData.contact.tagIds = newTagIds;
  

}



  /**
   * Execute text message node
   */
  private async executeTextMessageNode(node: any, context: ExecutionContext): Promise<void> {
    const nodeData = node.data || {};
    let message = nodeData.message || '';
    
    console.log(`[Automation] 💬 Text message node: ${node.id}`);
    
    if (message.includes('{{')) {
      // Replace variables
      const allVariables = VariableService.getAvailableVariables(
        context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 },
        context.currentData.contact,
        context.currentData.user
      );
      
      message = VariableService.replaceVariables(message, allVariables);
      console.log(`[Automation] Personalized message: ${message}`);
    }
    
    if (message.trim()) {
      await messageService.sendMessage({
        contactId: context.contactId,
        userId: context.userData.id,
        conversationId: context.currentData.conversation?.id,
        body: message,
        direction: 'outgoing',
        messageType: 'text',
        metadata: {
          automation: true,
          automationId: context.workflowId,
          automationName: 'Automation',
          nodeId: node.id,
          executionId: context.executionId,
        },
      });
      
      console.log(`[Automation] ✅ Message sent successfully`);
    }
  }

  /**
   * Execute delay node
   */
  private async executeDelayNode(node: any, context: ExecutionContext): Promise<void> {
    const nodeData = node.data || {};
    const delayValue = nodeData.delayValue || 0;
    const delayUnit = nodeData.delayUnit || 'minutes';
    
    console.log(`[Automation] ⏳ Delay node: ${delayValue} ${delayUnit}`);
    
    let delayMs = 0;
    switch (delayUnit) {
      case 'seconds':
        delayMs = delayValue * 1000;
        break;
      case 'minutes':
        delayMs = delayValue * 60 * 1000;
        break;
      case 'hours':
        delayMs = delayValue * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = delayValue * 24 * 60 * 60 * 1000;
        break;
    }
    
    if (delayMs > 0) {
      console.log(`[Automation] Waiting for ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      console.log(`[Automation] Delay completed`);
    }
  }

  /**
   * Execute condition node
   */
  private async executeConditionNode(node: any, context: ExecutionContext): Promise<{ success: boolean }> {
    console.log(`[Automation] 🔍 Condition node: ${node.id}`);
    // TODO: Implement condition logic
    return { success: true };
  }

  /**
   * Sort nodes by position (top to bottom, left to right)
   */
  private sortNodesByPosition(nodes: any[]): any[] {
    return [...nodes].sort((a, b) => {
      if (a.position.y !== b.position.y) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    });
  }

  /**
   * Generate random color for tags
   */
  private generateRandomColor(): string {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Update automation statistics
   */
  private async updateAutomationStats(automationId: string, success: boolean): Promise<void> {
    try {
      const db = getDb();
      await db.update(automations)
        .set({
          totalRuns: sql`${automations.totalRuns} + 1`,
          successfulRuns: sql`${automations.successfulRuns} + ${success ? 1 : 0}`,
          failedRuns: sql`${automations.failedRuns} + ${success ? 0 : 1}`,
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automations.id, automationId));
      
      console.log(`[Automation] 📊 Stats updated`);
    } catch (error) {
      console.warn('[Automation] Could not update stats:', error);
    }
  }

  /**
   * Save execution record
   */
  private async saveExecutionRecord(data: {
    automationId: string;
    contactId: string;
    userId: string;
    status: string;
    triggerData?: any;
    nodeExecutions?: any[];
    executionData?: any;
    error?: string;
    startedAt: Date;
    completedAt: Date;
  }): Promise<void> {
    try {
      const db = getDb();
      await db.insert(automationRuns).values({
        automationId: data.automationId,
        contactId: data.contactId,
        userId: data.userId,
        status: data.status,
        triggerData: data.triggerData || {},
        executionData: data.executionData || {},
        nodeExecutions: data.nodeExecutions || [],
        error: data.error,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        createdAt: new Date(),
      });
      
      console.log(`[Automation] 📝 Execution record saved`);
    } catch (error) {
      console.warn('[Automation] Could not save execution record:', error);
    }
  }

  /**
   * Manually trigger an automation for a contact
   */
  async triggerAutomation(
    automationId: string, 
    contactId: string, 
    userId: string, 
    triggerData?: any
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    return this.executeWorkflow(automationId, contactId, userId, triggerData);
  }

  /**
   * Get execution runs for an automation
   */
  async getAutomationRuns(automationId: string, userId: string, page = 1, limit = 20) {
    try {
      const db = getDb();
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