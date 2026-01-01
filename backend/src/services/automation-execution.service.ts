// backend/src/services/automation-execution.service.ts
import { getDb } from '../db/client';
import {
  automations,
  automationRuns,
  contacts,
  users,
  conversations,
  tags,
  mediaAttachments,
  quickReplies,
  messages,
} from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
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

    // Initialize nodeExecutions array at the beginning of the function
    const nodeExecutions: any[] = [];

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

      // Create a map of nodes by ID for quick lookup
      const nodeMap = new Map(flowData.nodes.map((n: any) => [n.id, n]));

      // Create a map of edges by source node
      const edgeMap = new Map<string, any[]>();
      flowData.edges.forEach((edge: any) => {
        if (!edgeMap.has(edge.source)) {
          edgeMap.set(edge.source, []);
        }
        edgeMap.get(edge.source)!.push(edge);
      });

      // Track visited nodes to avoid infinite loops
      const visitedNodes = new Set<string>();

      // Start from trigger node
      let currentNode = flowData.nodes.find((n: any) => n.type === 'triggerNode');

      if (!currentNode) {
        console.error(`[Automation] ❌ No trigger node found in flow`);
        return { success: false, error: 'No trigger node found' };
      }

      let executionCount = 0;
      const maxExecutions = 100; // Safety limit

      // Execution loop
while (currentNode && executionCount < maxExecutions) {
  executionCount++;

  // Skip if already visited (prevents loops)
  if (visitedNodes.has(currentNode.id)) {
    console.log(`[Automation] ⚠️ Already visited ${currentNode.id}, skipping to avoid loop`);
    break;
  }

  visitedNodes.add(currentNode.id);

  console.log(`[Automation] ➡️ Processing node: ${currentNode.id} (${currentNode.type})`);

  const nodeStartTime = Date.now();
  let nodeSuccess = false;
  let nodeError = null;
  let conditionResult = null;
  let keywordResult = null; // Add this for keyword nodes

  try {
    switch (currentNode.type) {
      case 'textMessageNode':
        await this.executeTextMessageNode(currentNode, context);
        nodeSuccess = true;
        break;

      case 'mediaMessageNode':
        await this.executeMediaMessageNode(currentNode, context);
        nodeSuccess = true;
        break;

      case 'quickRepliesNode':
        await this.executeQuickRepliesNode(currentNode, context);
        nodeSuccess = true;
        break;

      case 'keywordActionNode':
        const keywordResponse = await this.executeKeywordActionNode(currentNode, context);
        nodeSuccess = keywordResponse.success;
        keywordResult = keywordResponse.matched; // Store keyword result separately
        console.log(`[Automation] Keyword check result: ${keywordResult ? 'MATCH' : 'NO MATCH'}`);
        break;

      case 'tagNode':
        await this.executeTagNode(currentNode, context);
        nodeSuccess = true;
        break;

      case 'delayNode':
        await this.executeDelayNode(currentNode, context);
        nodeSuccess = true;
        break;

      case 'conditionNode':
        const conditionResponse = await this.executeConditionNode(currentNode, context);
        nodeSuccess = conditionResponse.success;
        conditionResult = conditionResponse.success;
        console.log(`[Automation] Condition result: ${conditionResult}`);
        break;

      case 'triggerNode':
        // Trigger node doesn't need execution, just continue
        console.log(`[Automation] ⚡ Trigger node: ${currentNode.data?.label || 'Trigger'}`);
        nodeSuccess = true;
        break;

      default:
        console.log(`[Automation] ⚠️ Unknown node type: ${currentNode.type}`);
        nodeSuccess = true;
    }
  } catch (error: any) {
    nodeError = error.message;
    console.error(`[Automation] ❌ Error in node ${currentNode.id}:`, error);
  }

  nodeExecutions.push({
    nodeId: currentNode.id,
    nodeType: currentNode.type,
    success: nodeSuccess,
    error: nodeError,
    duration: Date.now() - nodeStartTime,
    timestamp: new Date(),
    conditionResult,
    keywordResult, // Add this
  });

  // Determine next node based on edges
  const outgoingEdges = edgeMap.get(currentNode.id) || [];

  if (outgoingEdges.length === 0) {
    console.log(`[Automation] 🏁 No outgoing edges from ${currentNode.id}, execution complete`);
    break;
  }

  // Handle keyword action node branching (DIFFERENT from condition node!)
  if (currentNode.type === 'keywordActionNode') {
    const matchEdge = outgoingEdges.find(e => e.sourceHandle === 'match');
    const noMatchEdge = outgoingEdges.find(e => e.sourceHandle === 'no-match');

    let nextEdge;
    if (keywordResult === true && matchEdge) {
      nextEdge = matchEdge;
      console.log(`[Automation] ↪️ Keyword MATCH, following match branch to ${matchEdge.target}`);
    } else if (keywordResult === false && noMatchEdge) {
      nextEdge = noMatchEdge;
      console.log(`[Automation] ↪️ Keyword NO MATCH, following no-match branch to ${noMatchEdge.target}`);
    } else {
      // Fallback: follow first edge
      nextEdge = outgoingEdges[0];
      console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge.target}`);
    }

    if (nextEdge) {
      currentNode = nodeMap.get(nextEdge.target);
      continue;
    }
  }

  // Handle condition node branching
  if (currentNode.type === 'conditionNode') {
    const trueEdge = outgoingEdges.find(e => e.sourceHandle === 'true');
    const falseEdge = outgoingEdges.find(e => e.sourceHandle === 'false');

    let nextEdge;
    if (conditionResult === true && trueEdge) {
      nextEdge = trueEdge;
      console.log(`[Automation] ↪️ Condition TRUE, following true branch to ${trueEdge.target}`);
    } else if (conditionResult === false && falseEdge) {
      nextEdge = falseEdge;
      console.log(`[Automation] ↪️ Condition FALSE, following false branch to ${falseEdge.target}`);
    } else {
      // Fallback: follow first edge
      nextEdge = outgoingEdges[0];
      console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge.target}`);
    }

    if (nextEdge) {
      currentNode = nodeMap.get(nextEdge.target);
      continue;
    }
  }

  // For regular nodes, follow the first outgoing edge
  if (outgoingEdges.length > 0) {
    const nextEdge = outgoingEdges[0];
    currentNode = nodeMap.get(nextEdge.target);
  } else {
    currentNode = null;
  }
}

      if (executionCount >= maxExecutions) {
        console.warn(`[Automation] ⚠️ Execution stopped: reached maximum execution limit (${maxExecutions} nodes)`);
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
      console.log(`[Automation] Processed ${executionCount} nodes, ${nodeExecutions.filter(e => e.success).length} successful`);

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
          nodeExecutions,
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
   * Execute media message node
   */
  private async executeMediaMessageNode(node: any, context: ExecutionContext): Promise<void> {
    const nodeData = node.data || {};
    const media = nodeData.media || {};
    const mediaAttachmentId = nodeData.mediaAttachmentId;
    const caption = nodeData.caption || media.caption || '';

    console.log(`[Automation] 📎 Media message node: ${node.id}`);
    console.log(`[Automation] Media type: ${media.type}, Attachment ID: ${mediaAttachmentId}`);

    if (!mediaAttachmentId) {
      console.error(`[Automation] ❌ No media attachment ID found for node ${node.id}`);
      throw new Error('Media attachment not found');
    }

    const db = getDb();

    // 1. Get media attachment details
    const [mediaAttachment] = await db.select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.id, mediaAttachmentId))
      .limit(1);

    if (!mediaAttachment) {
      console.error(`[Automation] ❌ Media attachment ${mediaAttachmentId} not found`);
      throw new Error('Media attachment not found in database');
    }

    // 2. Personalize caption
    let personalizedCaption = caption;
    if (caption.includes('{{')) {
      const allVariables = VariableService.getAvailableVariables(
        context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 },
        context.currentData.contact,
        context.currentData.user
      );

      personalizedCaption = VariableService.replaceVariables(caption, allVariables);
      console.log(`[Automation] Personalized caption: ${personalizedCaption}`);
    }

    // 3. Send media message via WhatsApp
    const mediaType = mediaAttachment.resourceType === 'raw' ? 'document' :
      mediaAttachment.resourceType as 'image' | 'video' | 'audio';

    await messageService.sendMessage({
      contactId: context.contactId,
      userId: context.userData.id,
      conversationId: context.currentData.conversation?.id,
      body: personalizedCaption,
      attachments: [{
        id: mediaAttachmentId,
        secureUrl: mediaAttachment.secureUrl,
        url: mediaAttachment.secureUrl,
        mimeType: mediaAttachment.mimeType,
        originalFilename: mediaAttachment.originalFilename,
        filename: mediaAttachment.filename || mediaAttachment.originalFilename,
        fileSize: mediaAttachment.fileSize,
        width: mediaAttachment.width,
        height: mediaAttachment.height,
        duration: mediaAttachment.duration,
        caption: personalizedCaption,
      }],
      direction: 'outgoing',
      messageType: mediaType,
      metadata: {
        automation: true,
        automationId: context.workflowId,
        automationName: 'Automation',
        nodeId: node.id,
        executionId: context.executionId,
        mediaAttachmentId: mediaAttachmentId,
      },
    });

    console.log(`[Automation] ✅ Media message sent successfully`);
  }

  private async executeQuickRepliesNode(node: any, context: ExecutionContext): Promise<void> {
    const nodeData = node.data || {};
    const quickReplyId = nodeData.quickReplyId;

    console.log(`[Automation] ⚡ Quick Reply node: ${node.id}`);

    if (!quickReplyId) {
      console.error(`[Automation] ❌ No quick reply selected for node ${node.id}`);
      throw new Error('Quick reply not selected');
    }

    const db = getDb();

    // 1. Get quick reply
    const [quickReply] = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, context.userData.id),
        eq(quickReplies.isActive, true)
      ))
      .limit(1);

    if (!quickReply) {
      console.error(`[Automation] ❌ Quick reply ${quickReplyId} not found or inactive`);
      throw new Error('Quick reply not found');
    }

    // 2. Get media attachments if any
    let mediaAttachmentsList: any[] = [];
    if (quickReply.mediaAttachmentIds && quickReply.mediaAttachmentIds.length > 0) {
      mediaAttachmentsList = await db.select()
        .from(mediaAttachments)
        .where(inArray(mediaAttachments.id, quickReply.mediaAttachmentIds));

      console.log(`[Automation] 📦 Quick reply has ${mediaAttachmentsList.length} media attachments`);
    }

    // 3. Personalize message
    const allVariables = VariableService.getAvailableVariables(
      context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 },
      context.currentData.contact,
      context.currentData.user
    );

    const personalizedMessage = VariableService.replaceVariables(quickReply.message, allVariables);

    // 4. Format attachments for MessageService
    const formattedAttachments = mediaAttachmentsList.map((media: any) => ({
      id: media.id,
      url: media.secureUrl || media.thumbnailUrl,
      secureUrl: media.secureUrl || media.thumbnailUrl,
      mimeType: media.mimeType,
      originalFilename: media.originalFilename,
      filename: media.originalFilename,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      duration: media.duration,
      caption: personalizedMessage,
    }));

    // 5. Send message via WhatsApp
    if (formattedAttachments.length > 0) {
      // Send with media attachments
      await messageService.sendMessage({
        conversationId: context.currentData.conversation?.id,
        contactId: context.contactId,
        userId: context.userData.id,
        body: personalizedMessage,
        attachments: formattedAttachments,
        direction: 'outgoing',
        metadata: {
          automation: true,
          automationId: context.workflowId,
          automationName: 'Automation',
          nodeId: node.id,
          executionId: context.executionId,
          quickReplyId: quickReply.id,
          quickReplyName: quickReply.name,
        },
      });
    } else {
      // Send as text-only message
      await messageService.sendMessage({
        conversationId: context.currentData.conversation?.id,
        contactId: context.contactId,
        userId: context.userData.id,
        body: personalizedMessage,
        attachments: [],
        direction: 'outgoing',
        metadata: {
          automation: true,
          automationId: context.workflowId,
          automationName: 'Automation',
          nodeId: node.id,
          executionId: context.executionId,
          quickReplyId: quickReply.id,
          quickReplyName: quickReply.name,
        },
      });
    }

    console.log(`[Automation] ✅ Quick reply "${quickReply.name}" sent successfully`);
  }

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

    const nodeData = node.data || {};
    const rules = nodeData.rules || [];
    const logic = nodeData.logic || 'all';
    const nodeLabel = nodeData.label || 'Condition';

    console.log(`[Automation] Evaluating condition "${nodeLabel}" with ${rules.length} rules (${logic} logic)`);

    if (rules.length === 0) {
      console.log(`[Automation] ⚠️ No rules defined, condition passes by default`);
      return { success: true };
    }

    // Get data for evaluation
    const contact = context.currentData.contact;
    const conversation = context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 };
    const user = context.currentData.user;
    const triggerData = context.currentData.triggerData;

    // Prepare evaluation context
    const evaluationContext = {
      contact,
      conversation,
      user,
      triggerData,
      // Helper functions
      now: new Date(),
      date: (dateStr: string) => new Date(dateStr),
    };

    console.log(`[Automation] Evaluation context:`, {
      contactId: contact?.id,
      contactName: contact?.name,
      conversationId: conversation?.id,
    });

    // Evaluate each rule
    const ruleResults = rules.map((rule: any) => {
      try {
        const result = this.evaluateRule(rule, evaluationContext);
        console.log(`[Automation] Rule "${rule.field} ${rule.operator} ${rule.value}": ${result ? '✅ PASS' : '❌ FAIL'}`);
        return result;
      } catch (error: any) {
        console.error(`[Automation] ❌ Error evaluating rule:`, error.message);
        return false; // Treat errors as false
      }
    });

    // Apply logic (ALL or ANY)
    let finalResult: boolean;

    if (logic === 'all') {
      finalResult = ruleResults.every(result => result === true);
      console.log(`[Automation] ALL logic: ${finalResult ? '✅ ALL rules passed' : '❌ Some rules failed'}`);
    } else {
      finalResult = ruleResults.some(result => result === true);
      console.log(`[Automation] ANY logic: ${finalResult ? '✅ At least one rule passed' : '❌ No rules passed'}`);
    }

    // Update context with result for debugging
    context.currentData.conditionResults = context.currentData.conditionResults || {};
    context.currentData.conditionResults[node.id] = {
      success: finalResult,
      ruleResults,
      logic,
      timestamp: new Date(),
    };

    console.log(`[Automation] Condition "${nodeLabel}": ${finalResult ? '✅ PASS' : '❌ FAIL'}`);

    return { success: finalResult };
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: any, context: any): boolean {
    const { field, operator, value } = rule;

    if (!field) return false;

    // Get the actual value from context
    const actualValue = this.getValueFromContext(field, context);
    const comparisonValue = this.parseComparisonValue(value, field, context);

    console.log(`[Automation] Evaluating: ${field} ${operator} ${value}`);
    console.log(`[Automation] Actual value:`, actualValue);
    console.log(`[Automation] Comparison value:`, comparisonValue);

    switch (operator) {
      case 'equals':
        return this.equals(actualValue, comparisonValue);
      case 'not_equals':
        return !this.equals(actualValue, comparisonValue);
      case 'contains':
        return this.contains(actualValue, comparisonValue);
      case 'not_contains':
        return !this.contains(actualValue, comparisonValue);
      case 'starts_with':
        return this.startsWith(actualValue, comparisonValue);
      case 'ends_with':
        return this.endsWith(actualValue, comparisonValue);
      case 'greater_than':
        return this.greaterThan(actualValue, comparisonValue);
      case 'less_than':
        return this.lessThan(actualValue, comparisonValue);
      case 'greater_than_or_equal':
        return this.greaterThanOrEqual(actualValue, comparisonValue);
      case 'less_than_or_equal':
        return this.lessThanOrEqual(actualValue, comparisonValue);
      case 'is_empty':
        return this.isEmpty(actualValue);
      case 'is_not_empty':
        return !this.isEmpty(actualValue);
      case 'exists':
        return this.exists(actualValue);
      case 'not_exists':
        return !this.exists(actualValue);
      default:
        console.warn(`[Automation] Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get value from context using dot notation
   */
  private getValueFromContext(path: string, context: any): any {
    if (!path) return null;

    const parts = path.split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Handle array indices
      if (part.match(/^\d+$/)) {
        const index = parseInt(part, 10);
        if (Array.isArray(current) && index < current.length) {
          current = current[index];
        } else {
          return null;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * 
    * Execute keyword action node
  **/
private async executeKeywordActionNode(node: any, context: ExecutionContext): Promise<{ success: boolean; matched: boolean }> {
  const nodeData = node.data || {};
  const keywords = nodeData.keywords || [];
  const matchType = nodeData.matchType || 'contains';
  const caseSensitive = nodeData.caseSensitive || false;
  const matchAll = nodeData.matchAll || false;
  
  console.log(`[Automation] 🔤 Keyword action node: ${node.id}`);
  console.log(`[Automation] Keywords: ${keywords.length}, Match type: ${matchType}, Case: ${caseSensitive}, Logic: ${matchAll ? 'ALL' : 'ANY'}`);
  
  if (keywords.length === 0) {
    console.log(`[Automation] ⚠️ No keywords configured, skipping`);
    return { success: true, matched: false };
  }
  
  // Get the last message from the contact
  const db = getDb();
  const lastMessage = await db.select()
    .from(messages)
    .where(
      and(
        eq(messages.contactId, context.contactId),
        eq(messages.direction, 'incoming')
      )
    )
    .orderBy(desc(messages.timestamp))
    .limit(1);
  
  if (lastMessage.length === 0) {
    console.log(`[Automation] ⚠️ No incoming messages found for keyword check`);
    return { success: true, matched: false };
  }
  
  const messageText = lastMessage[0].body || '';
  
  // Use the same matching logic
  const matched = this.evaluateKeywords(
    messageText, 
    keywords, 
    matchType, 
    caseSensitive, 
    matchAll
  );
  
  console.log(`[Automation] Keyword check on message: "${messageText.substring(0, 50)}..."`);
  console.log(`[Automation] Result: ${matched ? '✅ MATCH' : '❌ NO MATCH'}`);
  
  return { success: true, matched };
}

/**
 * Evaluate keywords against a message
 */
private evaluateKeywords(
  message: string, 
  keywords: string[], 
  matchType: string, 
  caseSensitive: boolean,
  matchAll: boolean = false
): boolean {
  if (keywords.length === 0) return false;
  
  const normalizedMessage = caseSensitive ? message : message.toLowerCase();
  
  const matches = keywords.map(keyword => {
    const normalizedKeyword = caseSensitive ? keyword : keyword.toLowerCase();
    
    switch (matchType) {
      case 'exact':
        return normalizedMessage === normalizedKeyword;
      case 'contains':
        return normalizedMessage.includes(normalizedKeyword);
      case 'startsWith':
        return normalizedMessage.startsWith(normalizedKeyword);
      case 'endsWith':
        return normalizedMessage.endsWith(normalizedKeyword);
      default:
        return normalizedMessage.includes(normalizedKeyword);
    }
  });
  
  return matchAll 
    ? matches.every(match => match === true)
    : matches.some(match => match === true);
}

  /**
   * Parse comparison value (handle variables, dates, etc.)
   */
  private parseComparisonValue(value: string, fieldPath: string, context: any): any {
    if (!value) return null;

    // Check if value is a variable (e.g., {{contact.name}})
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const variablePath = value.slice(2, -2).trim();
      return this.getValueFromContext(variablePath, context);
    }

    // Parse numbers
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }

    // Parse booleans
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    if (value.toLowerCase() === 'yes') return true;
    if (value.toLowerCase() === 'no') return false;

    // Parse dates
    const date = this.parseDate(value);
    if (date) return date;

    // Return as string
    return value;
  }

  /**
   * Parse date from string
   */
  private parseDate(dateStr: string): Date | null {
    try {
      // Try ISO format
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(dateStr);
      }

      // Try relative date (e.g., "7 days ago", "tomorrow")
      const now = new Date();
      const relativeMatch = dateStr.match(/^(\d+)\s+(day|week|month|year)s?\s+(ago|from now)$/i);

      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        const direction = relativeMatch[3].toLowerCase();

        const multiplier = direction === 'ago' ? -1 : 1;

        switch (unit) {
          case 'day':
            return new Date(now.setDate(now.getDate() + (amount * multiplier)));
          case 'week':
            return new Date(now.setDate(now.getDate() + (amount * 7 * multiplier)));
          case 'month':
            return new Date(now.setMonth(now.getMonth() + (amount * multiplier)));
          case 'year':
            return new Date(now.setFullYear(now.getFullYear() + (amount * multiplier)));
        }
      }

      // Try common date formats
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }

  // Comparison functions
  private equals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Number comparison (loose equality for numbers)
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.000001;
    }

    // String comparison (case-insensitive)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() === b.toLowerCase();
    }

    // Array comparison (check if arrays contain same items)
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every(item => b.includes(item));
    }

    return a === b;
  }

  private contains(actualValue: any, searchValue: any): boolean {
    if (actualValue == null || searchValue == null) return false;

    // String contains
    if (typeof actualValue === 'string' && typeof searchValue === 'string') {
      return actualValue.toLowerCase().includes(searchValue.toLowerCase());
    }

    // Array contains
    if (Array.isArray(actualValue)) {
      return actualValue.some(item =>
        this.equals(item, searchValue)
      );
    }

    // Object contains key
    if (typeof actualValue === 'object' && actualValue !== null) {
      return Object.keys(actualValue).some(key =>
        this.equals(key, searchValue) || this.equals(actualValue[key], searchValue)
      );
    }

    return false;
  }

  private startsWith(actualValue: any, searchValue: any): boolean {
    if (typeof actualValue !== 'string' || typeof searchValue !== 'string') {
      return false;
    }
    return actualValue.toLowerCase().startsWith(searchValue.toLowerCase());
  }

  private endsWith(actualValue: any, searchValue: any): boolean {
    if (typeof actualValue !== 'string' || typeof searchValue !== 'string') {
      return false;
    }
    return actualValue.toLowerCase().endsWith(searchValue.toLowerCase());
  }

  private greaterThan(a: any, b: any): boolean {
    if (a == null || b == null) return false;

    // Number comparison
    if (typeof a === 'number' && typeof b === 'number') {
      return a > b;
    }

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() > b.getTime();
    }

    // String comparison (alphabetical)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() > b.toLowerCase();
    }

    return false;
  }

  private lessThan(a: any, b: any): boolean {
    if (a == null || b == null) return false;

    // Number comparison
    if (typeof a === 'number' && typeof b === 'number') {
      return a < b;
    }

    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() < b.getTime();
    }

    // String comparison (alphabetical)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() < b.toLowerCase();
    }

    return false;
  }

  private greaterThanOrEqual(a: any, b: any): boolean {
    return this.greaterThan(a, b) || this.equals(a, b);
  }

  private lessThanOrEqual(a: any, b: any): boolean {
    return this.lessThan(a, b) || this.equals(a, b);
  }

  private isEmpty(value: any): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  private exists(value: any): boolean {
    return value != null;
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