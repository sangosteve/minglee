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
import { eq, and, desc, sql, inArray, isNotNull } from 'drizzle-orm';
import { VariableService } from './variable.service';
import { messageService } from './message/message.service';

export interface ExecutionContext {
  contactId: string;
  workflowId: string;
  executionId: string;
  currentData: Record<string, any>;
  userData?: any;
}

// Type definitions for flow data
interface FlowNode {
  id: string;
  type: string;
  data?: any;
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
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
      const automationResult = await db.select({
        id: automations.id,
        name: automations.name,
        flowData: automations.flowData,
        userId: automations.userId
      })
        .from(automations)
        .where(eq(automations.id, automationId))
        .limit(1);

      if (!automationResult.length || !automationResult[0]) {
        console.error(`[Automation] ❌ Automation not found: ${automationId}`);
        return { success: false, error: 'Automation not found' };
      }

      const automation = automationResult[0];

      // Verify ownership
      if (automation.userId !== userId) {
        console.error(`[Automation] ❌ Unauthorized access to automation`);
        return { success: false, error: 'Unauthorized' };
      }

      // 2. Get user
      const userResult = await db.select({
        id: users.id,
        email: users.email,
        whatsappPhoneNumberId: users.whatsappPhoneNumberId,
        whatsappAccessToken: users.whatsappAccessToken,
      })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userResult.length || !userResult[0]) {
        console.error(`[Automation] ❌ User not found: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      const user = userResult[0];

      // 3. Get contact
      const contactResult = await db.select({
        id: contacts.id,
        phone: contacts.phone,
        name: contacts.name,
        email: contacts.email,
        tagIds: contacts.tagIds
      })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);

      if (!contactResult.length || !contactResult[0]) {
        console.error(`[Automation] ❌ Contact not found: ${contactId}`);
        return { success: false, error: 'Contact not found' };
      }

      const contact = contactResult[0];

      // 4. Get conversation
      let conversation = null;
      if (triggerData?.metadata?.conversation_id) {
        const conversationResult = await db.select()
          .from(conversations)
          .where(eq(conversations.id, triggerData.metadata.conversation_id))
          .limit(1);

        if (conversationResult.length && conversationResult[0]) {
          conversation = conversationResult[0];
        }
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

      // 6. Check if this is a continuation from an interactive message
      const isContinuation = triggerData?.interactiveAction?.originalExecutionId === executionId ||
        triggerData?.listSelection?.originalExecutionId === executionId;

      let startingNodeId = null;
      let selectedActionId = null;
      let selectedRowId = null;

      if (isContinuation) {
        if (triggerData?.interactiveAction) {
          console.log(`[Automation] ↪️ Continuing execution from interactive action`);
          console.log(`[Automation] Selected action: ${triggerData.interactiveAction.actionId}`);

          startingNodeId = triggerData.interactiveAction.nodeId;
          selectedActionId = triggerData.interactiveAction.actionId;

          // Store the action in context
          context.currentData.interactiveAction = triggerData.interactiveAction;
        } else if (triggerData?.listSelection) {
          console.log(`[Automation] ↪️ Continuing execution from list selection`);
          console.log(`[Automation] Selected row: ${triggerData.listSelection.selectedRowId}`);

          startingNodeId = triggerData.listSelection.nodeId;
          selectedRowId = triggerData.listSelection.selectedRowId;

          // Store the selection in context
          context.currentData.listSelection = triggerData.listSelection;
        }
      }

      // 7. Execute flow data
      const flowData = automation.flowData as FlowData;
      if (!flowData?.nodes || !Array.isArray(flowData.nodes)) {
        console.error(`[Automation] ❌ Invalid flow data`);
        return { success: false, error: 'Invalid flow data' };
      }

      console.log(`[Automation] Processing ${flowData.nodes.length} nodes`);

      // Create a map of nodes by ID for quick lookup
      const nodeMap = new Map<string, FlowNode>(flowData.nodes.map((n: FlowNode) => [n.id, n]));

      // Create a map of edges by source node AND by sourceHandle for branching
      const edgeMap = new Map<string, FlowEdge[]>();
      (flowData.edges || []).forEach((edge: FlowEdge) => {
        if (!edgeMap.has(edge.source)) {
          edgeMap.set(edge.source, []);
        }
        edgeMap.get(edge.source)!.push(edge);
      });

      // Track visited nodes to avoid infinite loops
      const visitedNodes = new Set<string>();

      // Start from trigger node OR from the interactive/list node if continuing
      let currentNode: FlowNode | undefined = startingNodeId
        ? flowData.nodes.find((n: FlowNode) => n.id === startingNodeId)
        : flowData.nodes.find((n: FlowNode) => n.type === 'triggerNode');

      if (!currentNode) {
        console.error(`[Automation] ❌ No starting node found`);
        return { success: false, error: 'No starting node found' };
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
        let nodeError: string | null = null;
        let conditionResult: boolean | null = null;
        let keywordResult: boolean | null = null;
        let listResult: string | null = null;
        let interactiveResult: string | null = null;

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
              keywordResult = keywordResponse.matched;
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
              console.log(`[Automation] ⚡ Trigger node: ${currentNode.data?.label || 'Trigger'}`);
              nodeSuccess = true;
              break;

            case 'listMessageNode':
              const listResponse = await this.executeListMessageNode(currentNode, context);
              nodeSuccess = listResponse.success;

              // If this is a continuation and we're at the list node, check for selection
              if (isContinuation && startingNodeId === currentNode.id && selectedRowId) {
                console.log(`[Automation] 🎯 Continuing from list selection: ${selectedRowId}`);
                listResult = selectedRowId;
              } else if (listResponse.pendingSelection) {
                // Store pending selection for branching
                context.currentData.pendingListSelection = listResponse.pendingSelection;
                console.log(`[Automation] List message sent, waiting for user selection`);

                // Save execution record and PAUSE
                nodeExecutions.push({
                  nodeId: currentNode.id,
                  nodeType: currentNode.type,
                  success: nodeSuccess,
                  error: nodeError,
                  duration: Date.now() - nodeStartTime,
                  timestamp: new Date(),
                  pendingSelection: true,
                  listMessageId: listResponse.sentMessageId,
                });

                // Update automation stats
                const allNodesSuccessful = nodeExecutions.every(exec => exec.success);
                await this.updateAutomationStats(automationId, allNodesSuccessful);

                // Save execution record
                await this.saveExecutionRecord({
                  automationId,
                  contactId,
                  userId,
                  status: 'pending_selection',
                  triggerData,
                  nodeExecutions,
                  executionData: context,
                  startedAt: new Date(),
                  completedAt: new Date(),
                });

                console.log(`[Automation] ⏸️ Execution paused, waiting for user selection`);
                return { success: true, executionId };
              }
              break;

            case 'interactiveMessageNode':
              const interactiveResponse = await this.executeInteractiveMessageNode(currentNode, context);
              nodeSuccess = interactiveResponse.success;

              // If this is a continuation and we're at the interactive node, check for action
              if (isContinuation && startingNodeId === currentNode.id && selectedActionId) {
                console.log(`[Automation] 🎯 Continuing from interactive action: ${selectedActionId}`);
                interactiveResult = selectedActionId;
              } else if (interactiveResponse.pendingAction) {
                // Store pending action for branching
                context.currentData.pendingInteractiveAction = interactiveResponse.pendingAction;
                console.log(`[Automation] Interactive message sent, waiting for user action`);

                // Save execution record and PAUSE
                nodeExecutions.push({
                  nodeId: currentNode.id,
                  nodeType: currentNode.type,
                  success: nodeSuccess,
                  error: nodeError,
                  duration: Date.now() - nodeStartTime,
                  timestamp: new Date(),
                  pendingAction: true,
                  interactiveMessageId: interactiveResponse.sentMessageId,
                });

                // Update automation stats
                const allNodesSuccessful = nodeExecutions.every(exec => exec.success);
                await this.updateAutomationStats(automationId, allNodesSuccessful);

                // Save execution record
                await this.saveExecutionRecord({
                  automationId,
                  contactId,
                  userId,
                  status: 'pending_action',
                  triggerData,
                  nodeExecutions,
                  executionData: context,
                  startedAt: new Date(),
                  completedAt: new Date(),
                });

                console.log(`[Automation] ⏸️ Execution paused, waiting for user action`);
                return { success: true, executionId };
              }
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
          keywordResult,
          listResult,
          interactiveResult,
        });

        // Determine next node based on edges
        const outgoingEdges = edgeMap.get(currentNode.id) || [];

        if (outgoingEdges.length === 0) {
          console.log(`[Automation] 🏁 No outgoing edges from ${currentNode.id}, execution complete`);
          break;
        }

        // Handle keyword action node branching
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
            console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
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
            console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
          }

          if (nextEdge) {
            currentNode = nodeMap.get(nextEdge.target);
            continue;
          }
        }

        // Handle list message node branching (when continuing from selection)
        if (currentNode.type === 'listMessageNode' && listResult) {
          console.log(`[Automation] 🎯 List selection made: ${listResult}`);

          // Find the edge with sourceHandle matching the selected row ID
          const selectedEdge = outgoingEdges.find(e => e.sourceHandle === listResult);

          if (selectedEdge) {
            currentNode = nodeMap.get(selectedEdge.target);
            console.log(`[Automation] ↪️ Following selection branch to ${selectedEdge.target}`);
            continue;
          } else {
            console.log(`[Automation] ⚠️ No edge found for selection ${listResult}, using first edge`);
          }
        }

        // Handle interactive message node branching (when continuing from action)
        if (currentNode.type === 'interactiveMessageNode' && interactiveResult) {
          console.log(`[Automation] 🎯 Interactive action made: ${interactiveResult}`);

          // Find the edge with sourceHandle matching the selected action ID
          const selectedEdge = outgoingEdges.find(e => e.sourceHandle === interactiveResult);

          if (selectedEdge) {
            currentNode = nodeMap.get(selectedEdge.target);
            console.log(`[Automation] ↪️ Following action branch to ${selectedEdge.target}`);
            continue;
          } else {
            console.log(`[Automation] ⚠️ No edge found for action ${interactiveResult}, using first edge`);
          }
        }

        // For regular nodes, follow the first outgoing edge
        if (outgoingEdges.length > 0) {
          const nextEdge = outgoingEdges[0];
          currentNode = nodeMap.get(nextEdge?.target||'');
        } else {
          currentNode = undefined;
        }
      }

      if (executionCount >= maxExecutions) {
        console.warn(`[Automation] ⚠️ Execution stopped: reached maximum execution limit (${maxExecutions} nodes)`);
      }

      // Update automation stats
      const allNodesSuccessful = nodeExecutions.every(exec => exec.success);
      await this.updateAutomationStats(automationId, allNodesSuccessful);

      // Save execution record
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
   * Execute Interactive Message Node
   */
  private async executeInteractiveMessageNode(
    node: FlowNode,
    context: ExecutionContext
  ): Promise<{
    success: boolean;
    pendingAction?: any;
    sentMessageId?: string | undefined;
  }> {
    const nodeData = node.data || {};

    console.log(`[Automation] 🎮 Interactive message node: ${node.id}`);
    console.log(`[Automation] Type: ${nodeData.type}, Actions:`, nodeData.actions?.map((a: any) => ({
      type: a.type,
      title: a.title,
      id: a.id
    })));

    // Personalize message with variables
    let personalizedBody = nodeData.body || '';
    let personalizedHeader = nodeData.header?.content || '';
    let personalizedFooter = nodeData.footer || '';

    if (personalizedBody.includes('{{') || personalizedHeader.includes('{{') || personalizedFooter.includes('{{')) {
      const allVariables = VariableService.getAvailableVariables(
        context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 },
        context.currentData.contact,
        context.currentData.user
      );

      personalizedBody = VariableService.replaceVariables(personalizedBody, allVariables);
      personalizedHeader = VariableService.replaceVariables(personalizedHeader, allVariables);
      personalizedFooter = VariableService.replaceVariables(personalizedFooter, allVariables);

      console.log(`[Automation] Personalized interactive message`);
    }

    // Format interactive data for WhatsApp API
    const interactiveData = this.formatInteractiveData(nodeData, personalizedBody, personalizedHeader, personalizedFooter);

    console.log(`[Automation] Interactive data prepared:`, JSON.stringify(interactiveData, null, 2));

    // Send via WhatsApp
    try {
      const result = await messageService.sendMessage({
        contactId: context.contactId,
        userId: context.userData.id,
        conversationId: context.currentData.conversation?.id,
        body: personalizedBody,
        direction: 'outgoing',
        messageType: 'interactive',
        metadata: {
          automation: true,
          automationId: context.workflowId,
          automationName: 'Automation',
          nodeId: node.id,
          executionId: context.executionId,
          interactiveData: interactiveData,
          // Store action IDs for later action tracking
          actionIds: (nodeData.actions || []).map((action: any) => ({
            id: action.id,
            type: action.type,
            title: action.title,  // Make sure title is included
            payload: action.payload,
            url: action.url,
            phoneNumber: action.phoneNumber,
          })),
          isInteractive: true,
          interactiveType: interactiveData.type,
        },
      });

      console.log(`[Automation] ✅ Interactive message sent successfully`);

      // For CTA_URL messages, we don't need to pause (user clicks URL, not a reply)
      // For REPLY buttons, we need to pause and wait for user response
      if (interactiveData.type === 'button') {
        return {
          success: true,
          pendingAction: {
            nodeId: node.id,
            actionIds: (nodeData.actions || [])
              .filter((action: any) => action.type === 'reply')
              .map((action: any) => ({
                id: action.id,
                type: action.type,
                title: action.title,  // Include title here too
                payload: action.payload,
              })),
            sentMessageId: result.message?.id || undefined
          },
          sentMessageId: result.message?.id || undefined
        };
      } else {
        // For CTA_URL, no pause needed
        return {
          success: true,
          sentMessageId: result?.message?.id || undefined
        };
      }

    } catch (error: any) {
      console.error(`[Automation] ❌ Error sending interactive message:`, error);
      console.error(`[Automation] ❌ Error details:`, error.response?.data || error.message);
      return { success: false };
    }
  }

  /**
   * Format interactive data for WhatsApp API
   */
  private formatInteractiveData(nodeData: any, body: string, header: string, footer: string): any {
    const type = nodeData.type || 'reply_buttons';

    console.log("🚀 FORMAT INTERACTIVE DATA");
    console.log("Type:", type);
    console.log("Full nodeData received:", JSON.stringify({
      type: nodeData.type,
      body: nodeData.body?.substring(0, 50),
      actions: nodeData.actions?.map((a: any, i: number) => ({
        index: i,
        type: a.type,
        title: a.title || 'MISSING TITLE',
        titleExists: !!a.title,
        titleLength: a.title?.length || 0,
        url: a.url,
        phoneNumber: a.phoneNumber,
        payload: a.payload
      }))
    }, null, 2));

    // Force check EVERY field
    if (nodeData.actions) {
      nodeData.actions.forEach((action: any, index: number) => {
        console.log(`🔍 Action ${index} deep inspection:`, {
          id: action.id,
          type: action.type,
          title: action.title,
          'title === "Open Link"': action.title === 'Open Link',
          'title === "Call Us"': action.title === 'Call Us',
          'title === "Button 1"': action.title === 'Button 1',
          'title?.includes("Open")': action.title?.includes('Open'),
          'title?.includes("Call")': action.title?.includes('Call'),
          'title?.includes("Button")': action.title?.includes('Button'),
          url: action.url,
          phoneNumber: action.phoneNumber,
          payload: action.payload,
          'ALL KEYS': Object.keys(action)
        });
      });
    }

    const allActions = nodeData.actions || [];
    const replyActions = allActions.filter((action: any) => action.type === 'reply');
    const urlActions = allActions.filter((action: any) => action.type === 'url');
    const callActions = allActions.filter((action: any) => action.type === 'call');

    console.log(`[Automation] Action breakdown:`, {
      total: allActions.length,
      reply: replyActions.length,
      url: urlActions.length,
      call: callActions.length
    });

    // Helper function to get button text from various possible fields
    const getButtonText = (action: any, index: number, defaultPrefix: string = 'Button'): string => {
      console.log(`🔍 Getting button text for action:`, {
        id: action.id,
        type: action.type,
        title: action.title,
        'title exists': !!action.title,
        'title string': typeof action.title,
        'title value': action.title
      });

      // Priority 1: Use user's custom title if provided and valid
      if (action.title !== undefined && action.title !== null && action.title.toString().trim() !== '') {
        const titleStr = action.title.toString();
        console.log(`✅ Using user's custom title: "${titleStr}"`);
        return titleStr.substring(0, 20);
      }

      // Priority 2: For reply actions, use payload if no title
      if (action.type === 'reply' && action.payload && action.payload.toString().trim() !== '') {
        const payloadStr = action.payload.toString();
        console.log(`⚠️ No custom title, using payload: "${payloadStr}"`);
        return payloadStr.substring(0, 20);
      }

      // Priority 3: For URL actions, use URL hostname
      if (action.type === 'url' && action.url) {
        try {
          const urlObj = new URL(action.url);
          const hostname = urlObj.hostname.replace('www.', '');
          console.log(`⚠️ No custom title, using hostname: "${hostname}"`);
          return hostname.substring(0, 20);
        } catch {
          console.log(`⚠️ No custom title, using default: "${defaultPrefix} ${index + 1}"`);
          return `${defaultPrefix} ${index + 1}`;
        }
      }

      // Priority 4: For call actions, use phone number
      if (action.type === 'call' && action.phoneNumber) {
        const phoneStr = action.phoneNumber.toString();
        console.log(`⚠️ No custom title, using phone: "${phoneStr}"`);
        return phoneStr.substring(0, 20);
      }

      // Final fallback with better debugging
      console.log(`⚠️ No usable text found for action:`, {
        actionType: action.type,
        hasTitle: !!action.title,
        hasPayload: !!action.payload,
        hasUrl: !!action.url,
        hasPhone: !!action.phoneNumber,
        usingDefault: `${defaultPrefix} ${index + 1}`
      });
      return `${defaultPrefix} ${index + 1}`;
    };

    switch (type) {
      case 'reply_buttons':
        // Reply buttons message - up to 3 REPLY buttons
        if (replyActions.length > 0) {
          const buttons = replyActions.slice(0, 3).map((action: any, index: number) => {
            const buttonTitle = getButtonText(action, index, 'Button');
            console.log(`[Automation] Button ${index + 1}: "${buttonTitle}" (ID: ${action.id})`);

            return {
              type: "reply",
              reply: {
                id: `btn_${action.id || `button_${index}`}`,
                title: buttonTitle
              }
            };
          });

          console.log(`[Automation] Creating REPLY buttons:`, buttons.map((b: any) => b.reply.title));

          return {
            type: "button",
            header: header ? {
              type: "text",
              text: header.substring(0, 60)
            } : undefined,
            body: {
              text: body.substring(0, 1024)
            },
            footer: footer ? {
              text: footer.substring(0, 60)
            } : undefined,
            action: {
              buttons: buttons
            }
          };
        } else {
          // No reply actions - shouldn't happen if UI is working correctly
          console.warn(`[Automation] No reply actions found for reply_buttons type`);

          return {
            type: "button",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              buttons: [{
                type: "reply",
                reply: {
                  id: "btn_default",
                  title: "OK"
                }
              }]
            }
          };
        }

      case 'quick_replies':
        // Quick replies - only REPLY type
        if (replyActions.length > 0) {
          const quickReplyButtons = replyActions.slice(0, 10).map((action: any, index: number) => {
            const buttonTitle = getButtonText(action, index, 'Reply');
            console.log(`[Automation] Quick Reply ${index + 1}: "${buttonTitle}"`);

            return {
              type: "reply",
              reply: {
                id: `qr_${action.id || `reply_${index}`}`,
                title: buttonTitle
              }
            };
          });

          return {
            type: "button",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              buttons: quickReplyButtons
            }
          };
        } else {
          console.warn(`[Automation] No reply actions found for quick_replies type`);

          return {
            type: "button",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              buttons: [{
                type: "reply",
                reply: {
                  id: "qr_default",
                  title: "OK"
                }
              }]
            }
          };
        }

      case 'list':
        // List messages - include all actions as list items
        if (allActions.length > 0) {
          const listRows = allActions.slice(0, 10).map((action: any, index: number) => {
            let description = '';

            if (action.type === 'url') {
              description = `🔗 ${action.url?.substring(0, 70) || 'Open link'}`;
            } else if (action.type === 'call') {
              description = `📞 ${action.phoneNumber || 'Call'}`;
            } else if (action.type === 'reply') {
              description = action.payload?.substring(0, 72) || '';
            }

            // Use the same getButtonText helper for list item titles
            const rowTitle = getButtonText(action, index, 'Option');
            console.log(`[Automation] List Row ${index + 1}: "${rowTitle}" (Type: ${action.type})`);

            return {
              id: `list_${action.id || `option_${index}`}`,
              title: rowTitle,
              description: description
            };
          });

          return {
            type: "list",
            header: header ? {
              type: "text",
              text: header.substring(0, 60)
            } : undefined,
            body: {
              text: body.substring(0, 1024)
            },
            footer: footer ? {
              text: footer.substring(0, 60)
            } : undefined,
            action: {
              button: nodeData.buttonText?.substring(0, 20) || "Options",
              sections: [{
                title: "Options",
                rows: listRows
              }]
            }
          };
        } else {
          console.warn(`[Automation] No actions found for list type`);

          return {
            type: "list",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              button: "Options",
              sections: [{
                title: "Options",
                rows: [{
                  id: "list_default",
                  title: "Default Option",
                  description: "No options configured"
                }]
              }]
            }
          };
        }

      case 'url_button':
        // Single URL button (CTA)
        if (urlActions.length > 0) {
          const urlAction = urlActions[0];
          const buttonTitle = getButtonText(urlAction, 0, 'Open Link');
          const buttonUrl = urlAction.url || "https://example.com";

          console.log(`[Automation] URL Button: "${buttonTitle}" -> ${buttonUrl}`);

          return {
            type: "cta_url",
            header: header ? {
              type: "text",
              text: header.substring(0, 60)
            } : undefined,
            body: {
              text: body.substring(0, 1024)
            },
            footer: footer ? {
              text: footer.substring(0, 60)
            } : undefined,
            action: {
              name: "cta_url",
              parameters: {
                display_text: buttonTitle,
                url: buttonUrl
              }
            }
          };
        } else {
          console.warn(`[Automation] No URL action found for url_button type`);

          return {
            type: "cta_url",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              name: "cta_url",
              parameters: {
                display_text: "Open Link",
                url: "https://example.com"
              }
            }
          };
        }

      case 'call_button':
        // Single Call button (CTA)
        if (callActions.length > 0) {
          const callAction = callActions[0];
          const buttonTitle = getButtonText(callAction, 0, 'Call Us');
          const phoneNumber = callAction.phoneNumber || "+1234567890";

          console.log(`[Automation] Call Button: "${buttonTitle}" -> ${phoneNumber}`);

          // Note: WhatsApp doesn't have a direct "cta_call" type
          // We'll send as a regular text message with phone number
          // Or use URL with tel: protocol
          return {
            type: "cta_url",
            header: header ? {
              type: "text",
              text: header.substring(0, 60)
            } : undefined,
            body: {
              text: body.substring(0, 1024)
            },
            footer: footer ? {
              text: footer.substring(0, 60)
            } : undefined,
            action: {
              name: "cta_url",
              parameters: {
                display_text: buttonTitle,
                url: `tel:${phoneNumber.replace(/\D/g, '')}`
              }
            }
          };
        } else {
          console.warn(`[Automation] No call action found for call_button type`);

          return {
            type: "cta_url",
            body: {
              text: body.substring(0, 1024)
            },
            action: {
              name: "cta_url",
              parameters: {
                display_text: "Call Us",
                url: "tel:+1234567890"
              }
            }
          };
        }

      default:
        console.warn(`[Automation] Unknown interactive type: ${type}, defaulting to button`);

        return {
          type: "button",
          body: {
            text: body.substring(0, 1024)
          },
          action: {
            buttons: [{
              type: "reply",
              reply: {
                id: "btn_default",
                title: "OK"
              }
            }]
          }
        };
    }
  }

  /**
   * Continue execution from an interactive action
   */
  async continueFromInteractiveAction(
    automationId: string,
    contactId: string,
    userId: string,
    interactiveAction: {
      nodeId: string;
      actionId: string;
      originalExecutionId: string;
      messageId?: string;
    }
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    console.log(`[Automation] 🔄 Continuing execution from interactive action`);
    console.log(`[Automation] Node: ${interactiveAction.nodeId}, Action: ${interactiveAction.actionId}`);

    // First, get the automation flow data
    const db = getDb();
    const automationResult = await db.select({
      id: automations.id,
      name: automations.name,
      flowData: automations.flowData,
      userId: automations.userId
    })
      .from(automations)
      .where(eq(automations.id, automationId))
      .limit(1);

    if (!automationResult.length || !automationResult[0]) {
      console.error(`[Automation] ❌ Automation not found: ${automationId}`);
      return { success: false, error: 'Automation not found' };
    }

    const automation = automationResult[0];

    // Get the flow data
    const flowData = automation.flowData as FlowData;
    if (!flowData?.nodes || !Array.isArray(flowData.nodes)) {
      console.error(`[Automation] ❌ Invalid flow data`);
      return { success: false, error: 'Invalid flow data' };
    }

    // Find the interactive message node
    const interactiveNode = flowData.nodes.find((n: FlowNode) => n.id === interactiveAction.nodeId);
    if (!interactiveNode) {
      console.error(`[Automation] ❌ Interactive message node not found: ${interactiveAction.nodeId}`);
      return { success: false, error: 'Interactive message node not found' };
    }

    console.log(`[Automation] Found interactive node: ${interactiveNode.id}, edges: ${flowData.edges?.length || 0}`);

    // Find edges connected FROM the interactive node
    const edgesFromNode = (flowData.edges || []).filter((edge: FlowEdge) => edge.source === interactiveAction.nodeId);
    console.log(`[Automation] Edges from interactive node:`, edgesFromNode.map((e: FlowEdge) => ({
      sourceHandle: e.sourceHandle,
      target: e.target,
      actionId: e.sourceHandle
    })));

    // Find the edge with sourceHandle matching the selected action
    let selectedEdge = null;

    // Try exact match first
    selectedEdge = edgesFromNode.find((edge: FlowEdge) =>
      edge.sourceHandle === interactiveAction.actionId
    );

    // If not found, try matching by action ID pattern
    if (!selectedEdge) {
      console.log(`[Automation] No exact match for ${interactiveAction.actionId}, trying pattern match...`);

      // Look for edges with sourceHandle containing the action ID
      selectedEdge = edgesFromNode.find((edge: FlowEdge) => {
        if (!edge.sourceHandle) return false;

        // Handle different edge ID patterns
        const sourceHandle = edge.sourceHandle.toLowerCase();
        const actionId = interactiveAction.actionId.toLowerCase();

        return sourceHandle.includes(actionId) ||
          sourceHandle.includes(`action-${actionId}`) ||
          sourceHandle.includes(`action_${actionId}`);
      });
    }

    if (!selectedEdge) {
      console.error(`[Automation] ❌ No edge found for selected action: ${interactiveAction.actionId}`);
      console.error(`[Automation] Available edges:`, edgesFromNode.map((e: FlowEdge) => e.sourceHandle));
      return { success: false, error: 'No branch found for selected action' };
    }

    console.log(`[Automation] ✅ Found edge for action:`, {
      sourceHandle: selectedEdge.sourceHandle,
      target: selectedEdge.target,
      targetNodeType: flowData.nodes.find((n: FlowNode) => n.id === selectedEdge.target)?.type
    });

    // Create a new execution ID for the continuation
    const continuationExecutionId = `exec-continue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get user
    const userResult = await db.select({
      id: users.id,
      email: users.email,
      whatsappPhoneNumberId: users.whatsappPhoneNumberId,
      whatsappAccessToken: users.whatsappAccessToken,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult.length || !userResult[0]) {
      console.error(`[Automation] ❌ User not found: ${userId}`);
      return { success: false, error: 'User not found' };
    }

    const user = userResult[0];

    // Get contact
    const contactResult = await db.select({
      id: contacts.id,
      phone: contacts.phone,
      name: contacts.name,
      email: contacts.email,
      tagIds: contacts.tagIds
    })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (!contactResult.length || !contactResult[0]) {
      console.error(`[Automation] ❌ Contact not found: ${contactId}`);
      return { success: false, error: 'Contact not found' };
    }

    const contact = contactResult[0];

    // Get conversation from the original message
    let conversation = null;
    if (interactiveAction.messageId) {
      const messageResult = await db.select({
        conversationId: messages.conversationId
      })
        .from(messages)
        .where(eq(messages.id, interactiveAction.messageId))
        .limit(1);

if (messageResult.length && messageResult[0]) {
  const conversationResult = await db.select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, messageResult[0].conversationId as string), // Type assertion
        isNotNull(conversations.id)
      )
    )
    .limit(1);
    
  if (conversationResult.length && conversationResult[0]) {
    conversation = conversationResult[0];
  }
}
    }

    // Create execution context for continuation
    const context: ExecutionContext = {
      contactId: contact.id,
      workflowId: automation.id,
      executionId: continuationExecutionId,
      currentData: {
        contact,
        user,
        conversation,
        triggerData: {
          interactiveAction: interactiveAction,
          isContinuation: true,
        },
        variables: {},
        // Store the action info
        interactiveAction: {
          selectedActionId: interactiveAction.actionId,
          originalNodeId: interactiveAction.nodeId,
        }
      },
      userData: user
    };

    // Now execute starting from the TARGET node of the selected edge
    const nodeMap = new Map<string, FlowNode>(flowData.nodes.map((n: FlowNode) => [n.id, n]));
    const edgeMap = new Map<string, FlowEdge[]>();

    (flowData.edges || []).forEach((edge: FlowEdge) => {
      if (!edgeMap.has(edge.source)) {
        edgeMap.set(edge.source, []);
      }
      edgeMap.get(edge.source)!.push(edge);
    });

    // Start execution from the TARGET node of the selected edge
    let currentNode = nodeMap.get(selectedEdge.target);

    if (!currentNode) {
      console.error(`[Automation] ❌ Target node not found: ${selectedEdge.target}`);
      return { success: false, error: 'Target node not found' };
    }

    console.log(`[Automation] 🚀 Starting continuation from node: ${currentNode.id} (${currentNode.type})`);

    let executionCount = 0;
    const maxExecutions = 50; // Safety limit for continuation
    const nodeExecutions: any[] = [];
    const visitedNodes = new Set<string>();

    // Track that we came from an interactive action
    visitedNodes.add(interactiveAction.nodeId);

    // Execution loop for continuation
    while (currentNode && executionCount < maxExecutions) {
      executionCount++;

      // Skip if already visited (prevents loops)
      if (visitedNodes.has(currentNode.id)) {
        console.log(`[Automation] ⚠️ Already visited ${currentNode.id}, stopping continuation`);
        break;
      }

      visitedNodes.add(currentNode.id);

      console.log(`[Automation] ➡️ Processing continuation node: ${currentNode.id} (${currentNode.type})`);

      const nodeStartTime = Date.now();
      let nodeSuccess = false;
      let nodeError: string | null = null;
      let conditionResult: boolean | null = null;
      let keywordResult: boolean | null = null;

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
            keywordResult = keywordResponse.matched;
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

          case 'listMessageNode':
            console.log(`[Automation] 📋 Executing list message node`);
            const listResponse = await this.executeListMessageNode(currentNode, context);
            nodeSuccess = listResponse.success;

            // If we're sending a NEW list message, check if we need to pause
            if (listResponse.pendingSelection) {
              // Store pending selection and pause execution
              context.currentData.pendingListSelection = listResponse.pendingSelection;
              console.log(`[Automation] List message sent, waiting for user selection`);

              // Save execution record and PAUSE
              nodeExecutions.push({
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                success: nodeSuccess,
                error: nodeError,
                duration: Date.now() - nodeStartTime,
                timestamp: new Date(),
                pendingSelection: true,
                listMessageId: listResponse.sentMessageId,
              });

              // Save and pause execution
              await this.saveExecutionRecord({
                automationId,
                contactId,
                userId,
                status: 'pending_selection',
                triggerData: {
                  interactiveAction: interactiveAction,
                  isContinuation: true,
                },
                nodeExecutions,
                executionData: context,
                startedAt: new Date(),
                completedAt: new Date(),
              });

              console.log(`[Automation] ⏸️ Execution paused, waiting for user selection`);
              return { success: true, executionId: continuationExecutionId };
            }
            break;

          case 'interactiveMessageNode':
            console.log(`[Automation] 🎮 Executing interactive message node`);
            const interactiveResponse = await this.executeInteractiveMessageNode(currentNode, context);
            nodeSuccess = interactiveResponse.success;

            // If we're sending an interactive message, check if we need to pause
            if (interactiveResponse.pendingAction) {
              // Store pending action and pause execution
              context.currentData.pendingInteractiveAction = interactiveResponse.pendingAction;
              console.log(`[Automation] Interactive message sent, waiting for user action`);

              // Save execution record and PAUSE
              nodeExecutions.push({
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                success: nodeSuccess,
                error: nodeError,
                duration: Date.now() - nodeStartTime,
                timestamp: new Date(),
                pendingAction: true,
                interactiveMessageId: interactiveResponse.sentMessageId,
              });

              // Save and pause execution
              await this.saveExecutionRecord({
                automationId,
                contactId,
                userId,
                status: 'pending_action',
                triggerData: {
                  interactiveAction: interactiveAction,
                  isContinuation: true,
                },
                nodeExecutions,
                executionData: context,
                startedAt: new Date(),
                completedAt: new Date(),
              });

              console.log(`[Automation] ⏸️ Execution paused, waiting for user action`);
              return { success: true, executionId: continuationExecutionId };
            }
            break;
          default:
            console.log(`[Automation] ⚠️ Unknown node type in continuation: ${currentNode.type}`);
            nodeSuccess = true;
        }
      } catch (error: any) {
        nodeError = error.message;
        console.error(`[Automation] ❌ Error in continuation node ${currentNode.id}:`, error);
      }

      nodeExecutions.push({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        success: nodeSuccess,
        error: nodeError,
        duration: Date.now() - nodeStartTime,
        timestamp: new Date(),
        conditionResult,
        keywordResult,
      });

      // Determine next node based on edges
      const outgoingEdges = edgeMap.get(currentNode.id) || [];

      if (outgoingEdges.length === 0) {
        console.log(`[Automation] 🏁 No outgoing edges from ${currentNode.id}, continuation complete`);
        break;
      }

      // Handle keyword action node branching
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
          nextEdge = outgoingEdges[0];
          console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
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
          nextEdge = outgoingEdges[0];
          console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
        }

        if (nextEdge) {
          currentNode = nodeMap.get(nextEdge.target);
          continue;
        }
      }

      // For regular nodes, follow the first outgoing edge
      if (outgoingEdges.length > 0) {
        const nextEdge = outgoingEdges[0];
        currentNode = nodeMap.get(nextEdge?.target||'');
      } else {
        currentNode = undefined;
      }
    }

    if (executionCount >= maxExecutions) {
      console.warn(`[Automation] ⚠️ Continuation stopped: reached maximum execution limit (${maxExecutions} nodes)`);
    }

    // Save continuation execution record
    await this.saveExecutionRecord({
      automationId,
      contactId,
      userId,
      status: 'completed',
      triggerData: {
        interactiveAction: interactiveAction,
        isContinuation: true,
      },
      nodeExecutions: [
        {
          nodeId: interactiveAction.nodeId,
          nodeType: 'interactiveMessageNode',
          success: true,
          duration: 0,
          timestamp: new Date(),
          interactiveAction: interactiveAction.actionId,
        },
        ...nodeExecutions
      ],
      executionData: context,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    console.log(`[Automation] ✅ Continuation completed: ${continuationExecutionId}`);
    console.log(`[Automation] Processed ${executionCount} continuation nodes`);

    return { success: true, executionId: continuationExecutionId };
  }

  /**
   * Handle incoming interactive action from webhook
   */
  async handleInteractiveAction(
    messageId: string,
    actionId: string,
    contactId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDb();

      // Get the original message that this action is responding to
      const messageResult = await db.select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!messageResult.length || !messageResult[0]) {
        console.error(`[Automation] ❌ Original message not found: ${messageId}`);
        return { success: false, error: 'Original message not found' };
      }

      const originalMessage = messageResult[0];

      // Check if this message is from an automation with interactive data
      const metadata = originalMessage.metadata as any;
      if (!metadata?.automation || !metadata?.automationId) {
        console.log(`[Automation] Message is not from an automation`);
        return { success: false, error: 'Not an automation message' };
      }

      const automationId = metadata.automationId;
      const nodeId = metadata.nodeId;
      const originalExecutionId = metadata.executionId;
      const actionIds = metadata.actionIds || [];

      console.log(`[Automation] Handling interactive action for automation:`, {
        automationId,
        nodeId,
        actionId,
        actionIds: actionIds.length,
      });

      // Find the matching action
      const matchedAction = actionIds.find((action: any) => {
        // Check for various ID formats
        return action.id === actionId ||
          `btn_${action.id}` === actionId ||
          `qr_${action.id}` === actionId ||
          `list_${action.id}` === actionId;
      });

      if (!matchedAction) {
        console.warn(`[Automation] ⚠️ Action ${actionId} not found in action list`);
        // Try to use the actionId directly
      }

      // Continue the automation execution
      const result = await this.continueFromInteractiveAction(
        automationId,
        contactId,
        userId,
        {
          nodeId: nodeId,
          actionId: matchedAction?.id || actionId,
          originalExecutionId: originalExecutionId,
          messageId: messageId,
        }
      );

      if (result.success) {
        console.log(`[Automation] ✅ Automation continued from interactive action`);
      } else {
        console.error(`[Automation] ❌ Failed to continue automation: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error(`[Automation] ❌ Error handling interactive action:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute text message node
   */
  private async executeTextMessageNode(node: FlowNode, context: ExecutionContext): Promise<void> {
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
   * Execute media message node
   */
  private async executeMediaMessageNode(node: FlowNode, context: ExecutionContext): Promise<void> {
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
    const mediaAttachmentResult = await db.select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.id, mediaAttachmentId))
      .limit(1);

    if (!mediaAttachmentResult.length || !mediaAttachmentResult[0]) {
      console.error(`[Automation] ❌ Media attachment ${mediaAttachmentId} not found`);
      throw new Error('Media attachment not found in database');
    }

    const mediaAttachment = mediaAttachmentResult[0];

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
        mimeType: mediaAttachment.mimeType|| 'application/octet-stream',
        originalFilename: mediaAttachment.originalFilename|| 'attachment',
        filename:mediaAttachment.originalFilename || 'attachment',
        fileSize: mediaAttachment.fileSize|| 0,
        width: mediaAttachment.width|| 0,
        height: mediaAttachment.height||0,
        duration: mediaAttachment.duration|| 0,
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

  /**
   * Execute quick replies node
   */
  private async executeQuickRepliesNode(node: FlowNode, context: ExecutionContext): Promise<void> {
    const nodeData = node.data || {};
    const quickReplyId = nodeData.quickReplyId;

    console.log(`[Automation] ⚡ Quick Reply node: ${node.id}`);

    if (!quickReplyId) {
      console.error(`[Automation] ❌ No quick reply selected for node ${node.id}`);
      throw new Error('Quick reply not selected');
    }

    const db = getDb();

    // 1. Get quick reply
    const quickReplyResult = await db.select()
      .from(quickReplies)
      .where(and(
        eq(quickReplies.id, quickReplyId),
        eq(quickReplies.userId, context.userData.id),
        eq(quickReplies.isActive, true)
      ))
      .limit(1);

    if (!quickReplyResult.length || !quickReplyResult[0]) {
      console.error(`[Automation] ❌ Quick reply ${quickReplyId} not found or inactive`);
      throw new Error('Quick reply not found');
    }

    const quickReply = quickReplyResult[0];

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
   * Execute tag node
   */
  private async executeTagNode(node: FlowNode, context: ExecutionContext): Promise<void> {
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

          if (existingTags.length > 0 && existingTags[0]) {
            foundTagIds.push(existingTags[0].id);
            console.log(`[Automation] Found existing tag "${tagName}": ${existingTags[0].id}`);
          } else {
            // Create new tag
            console.log(`[Automation] Creating new tag "${tagName}"...`);
            const newTagResult = await db.insert(tags).values({
              name: tagName,
              color: this.generateRandomColor(),
              userId: userId,
            }).returning();

            if (newTagResult.length && newTagResult[0]) {
              foundTagIds.push(newTagResult[0].id);
              console.log(`[Automation] ✅ Created new tag "${tagName}": ${newTagResult[0].id}`);
            }
          }
        } catch (error: any) {
          console.error(`[Automation] ❌ Error processing tag "${tagName}":`, error.message);

          // If it's a duplicate, try to find it again
          if (error.code === '23505' || error.message?.includes('unique constraint')) {
            console.log(`[Automation] Tag "${tagName}" already exists, trying to find it...`);

            const duplicateTagResult = await db.select()
              .from(tags)
              .where(
                and(
                  eq(tags.name, tagName),
                  eq(tags.userId, userId)
                )
              )
              .limit(1);

            if (duplicateTagResult.length && duplicateTagResult[0]) {
              foundTagIds.push(duplicateTagResult[0].id);
              console.log(`[Automation] Found duplicate tag: ${duplicateTagResult[0].id}`);
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
          const existingTagResult = await db.select()
            .from(tags)
            .where(
              and(
                eq(tags.name, tagName),
                eq(tags.userId, userId)
              )
            )
            .limit(1);

          if (existingTagResult.length && existingTagResult[0]) {
            validTagIds.push(existingTagResult[0].id);
            console.log(`[Automation] Temporary tag "${tagName}" already exists: ${existingTagResult[0].id}`);
          } else {
            // Create new tag
            const newTagResult = await db.insert(tags).values({
              name: tagName,
              color: this.generateRandomColor(),
              userId: userId,
  
            }).returning();

            if (newTagResult.length && newTagResult[0]) {
              validTagIds.push(newTagResult[0].id);
              console.log(`[Automation] ✅ Created temporary tag "${tagName}": ${newTagResult[0].id}`);
            }
          }
        } catch (error: any) {
          console.error(`[Automation] ❌ Failed to create tag "${tagName}":`, error.message);

          // If duplicate, find it
          if (error.code === '23505' || error.message?.includes('unique constraint')) {
            const duplicateTagResult = await db.select()
              .from(tags)
              .where(
                and(
                  eq(tags.name, tagName),
                  eq(tags.userId, userId)
                )
              )
              .limit(1);

            if (duplicateTagResult.length && duplicateTagResult[0]) {
              validTagIds.push(duplicateTagResult[0].id);
              console.log(`[Automation] Found duplicate temporary tag: ${duplicateTagResult[0].id}`);
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

    // Verify all tag IDs belong to the user
    let userTags: any[];

    try {
      userTags = await db.select()
        .from(tags)
        .where(
          and(
            eq(tags.userId, userId),
            inArray(tags.id, validTagIds)
          )
        );
    } catch (error) {
      console.warn('[Automation] Array method failed, trying alternative...');
      userTags = [];
    }

    const verifiedTagIds = userTags.map(tag => tag.id);

    if (verifiedTagIds.length !== validTagIds.length) {
      const missingIds = validTagIds.filter((id: string) => !verifiedTagIds.includes(id));
      console.warn(`[Automation] ⚠️ Some tags not found for user:`, missingIds);
    }

    if (verifiedTagIds.length === 0) {
      console.log('[Automation] ⚠️ No verified tags to process, skipping');
      return;
    }

    // Get current contact with tags
    const contactResult = await db.select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      tagIds: contacts.tagIds,
    })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (!contactResult.length || !contactResult[0]) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    const contact = contactResult[0];

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
        updatedAt: new Date().toISOString(),
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
   * Execute delay node
   */
  private async executeDelayNode(node: FlowNode, context: ExecutionContext): Promise<void> {
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
  private async executeConditionNode(node: FlowNode, context: ExecutionContext): Promise<{ success: boolean }> {
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
      finalResult = ruleResults.every((result: boolean) => result === true);
      console.log(`[Automation] ALL logic: ${finalResult ? '✅ ALL rules passed' : '❌ Some rules failed'}`);
    } else {
      finalResult = ruleResults.some((result: boolean) => result === true);
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
   * Execute List Option Node
   */
  private async executeListMessageNode(node: FlowNode, context: ExecutionContext): Promise<{
    success: boolean;
    pendingSelection?: any;
    sentMessageId?: string|null;
  }> {
    const nodeData = node.data || {};

    console.log(`[Automation] 📋 List message node: ${node.id}`);
    console.log(`[Automation] Sections: ${nodeData.sections?.length || 0}, Options: ${nodeData.sections?.reduce((total: number, sec: any) => total + (sec.rows?.length || 0), 0) || 0}`);

    // Personalize message with variables
    let personalizedBody = nodeData.body || '';
    let personalizedHeader = nodeData.header || '';
    let personalizedFooter = nodeData.footer || '';

    if (personalizedBody.includes('{{') || personalizedHeader.includes('{{') || personalizedFooter.includes('{{')) {
      const allVariables = VariableService.getAvailableVariables(
        context.currentData.conversation || { id: 'temp', status: 'active', unreadCount: 0 },
        context.currentData.contact,
        context.currentData.user
      );

      personalizedBody = VariableService.replaceVariables(personalizedBody, allVariables);
      personalizedHeader = VariableService.replaceVariables(personalizedHeader, allVariables);
      personalizedFooter = VariableService.replaceVariables(personalizedFooter, allVariables);

      console.log(`[Automation] Personalized list message`);
    }

    // Format list data for WhatsApp API
    const interactiveData = {
      type: "list",
      header: personalizedHeader ? {
        type: "text",
        text: personalizedHeader.substring(0, 60)
      } : undefined,
      body: {
        text: personalizedBody.substring(0, 1024)
      },
      footer: personalizedFooter ? {
        text: personalizedFooter.substring(0, 60)
      } : undefined,
      action: {
        button: nodeData.buttonText?.substring(0, 20) || "Options",
        sections: (nodeData.sections || []).map((section: any) => {
          return {
            title: section.title?.substring(0, 24) || "Section",
            rows: (section.rows || []).map((row: any, index: number) => {
              const rowId = `row_${row.id || `option_${Date.now()}_${index}`}`;

              return {
                id: rowId,
                title: row.title?.substring(0, 24) || `Option ${index + 1}`,
                description: row.description?.substring(0, 72)
              };
            }).slice(0, 10)
          };
        }).slice(0, 10)
      }
    };

    console.log(`[Automation] Interactive data prepared:`, JSON.stringify(interactiveData, null, 2));

    // Send via WhatsApp
    try {
  const result = await messageService.sendMessage({
    contactId: context.contactId,
    userId: context.userData.id,
    conversationId: context.currentData.conversation?.id,
    body: personalizedBody,
    direction: 'outgoing',
    messageType: 'interactive',
    metadata: {
      automation: true,
      automationId: context.workflowId,
      automationName: 'Automation',
      nodeId: node.id,
      executionId: context.executionId,
      listData: interactiveData,
      // Store row IDs for later selection tracking
      rowIds: (nodeData.sections || []).flatMap((section: any) =>
        (section.rows || []).map((row: any, index: number) => ({
          originalId: row.id,
          whatsappId: `row_${row.id || `option_${Date.now()}_${index}`}`,
          title: row.title
        }))
      ),
      isInteractiveList: true,
    },
  });

  console.log(`[Automation] ✅ List message sent successfully`);

  // SAFE ACCESS: Check if result and message exist
  const sentMessageId = result?.message?.id || null;

  // Return pending selection to pause execution
  return {
    success: true,
    pendingSelection: {
      nodeId: node.id,
      rowIds: (nodeData.sections || []).flatMap((section: any) =>
        (section.rows || []).map((row: any, index: number) => ({
          originalId: row.id,
          whatsappId: `row_${row.id || `option_${Date.now()}_${index}`}`,
          title: row.title
        }))
      ),
      sentMessageId: sentMessageId,
    },
    sentMessageId: sentMessageId
  };

} catch (error: any) {
  console.error(`[Automation] ❌ Error sending list message:`, error);
  return { success: false };
}
  }

  /**
   * Execute keyword action node
   */
  private async executeKeywordActionNode(node: FlowNode, context: ExecutionContext): Promise<{ success: boolean; matched: boolean }> {
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
    const lastMessageResult = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.contactId, context.contactId),
          eq(messages.direction, 'incoming')
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(1);

    if (!lastMessageResult.length || !lastMessageResult[0]) {
      console.log(`[Automation] ⚠️ No incoming messages found for keyword check`);
      return { success: true, matched: false };
    }

    const messageText = lastMessageResult[0].body || '';

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
  // Extract with safe defaults
  const amountStr = relativeMatch[1];
  const unitStr = relativeMatch[2];
  const directionStr = relativeMatch[3];
  
  // Check if all required groups exist
  if (!amountStr || !unitStr || !directionStr) {
    return null;
  }
  
  const amount = parseInt(amountStr, 10);
  
  // Check if parsing succeeded
  if (isNaN(amount)) {
    return null;
  }
  
  const unit = unitStr.toLowerCase();
  const direction = directionStr.toLowerCase();

  const multiplier = direction === 'ago' ? -1 : 1;

  // Create a new Date object to avoid mutating the original
  const resultDate = new Date(now);
  
  switch (unit) {
    case 'day':
      resultDate.setDate(resultDate.getDate() + (amount * multiplier));
      break;
    case 'week':
      resultDate.setDate(resultDate.getDate() + (amount * 7 * multiplier));
      break;
    case 'month':
      resultDate.setMonth(resultDate.getMonth() + (amount * multiplier));
      break;
    case 'year':
      resultDate.setFullYear(resultDate.getFullYear() + (amount * multiplier));
      break;
    default:
      return null;
  }
  
  return resultDate;
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
  private sortNodesByPosition(nodes: FlowNode[]): FlowNode[] {
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
  
  // Add a fallback to ensure we always return a string
  const randomIndex = Math.floor(Math.random() * colors.length);
  const color = colors[randomIndex];
  
  // Ensure we always have a valid color
  return color || '#3B82F6'; // Fallback to blue
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
          lastRunAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
    
    // First, let's check what fields are actually available in automationRuns
    // by looking at a sample or logging the structure
    console.log('[Automation] Available fields in automationRuns:', Object.keys(automationRuns));
    
    // Create a properly typed insert based on your schema
    // Adjust field names based on your actual schema
    const insertData: any = {
      // Common field mappings (adjust based on your schema)
      automation_id: data.automationId,
      contact_id: data.contactId,
      user_id: data.userId,
      status: data.status,
      trigger_data: data.triggerData || {},
      execution_data: data.executionData || {},
      node_executions: data.nodeExecutions || [],
      error: data.error || null,
      started_at: data.startedAt.toISOString(),
      completed_at: data.completedAt.toISOString(),
      created_at: new Date().toISOString(),
    };
    
    // Remove any undefined values
    Object.keys(insertData).forEach(key => {
      if (insertData[key] === undefined) {
        delete insertData[key];
      }
    });
    
    await db.insert(automationRuns).values(insertData);
    
    console.log(`[Automation] 📝 Execution record saved`);
  } catch (error) {
    console.warn('[Automation] Could not save execution record:', error);
    // For debugging, log the actual error details
    if (error instanceof Error) {
      console.warn('[Automation] Error details:', error.message);
    }
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
   * Continue execution from a list message selection
   */
  async continueFromListSelection(
    automationId: string,
    contactId: string,
    userId: string,
    listSelection: {
      nodeId: string;
      selectedRowId: string;
      originalExecutionId: string;
      messageId?: string;
    }
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    console.log(`[Automation] 🔄 Continuing execution from list selection`);
    console.log(`[Automation] Node: ${listSelection.nodeId}, Row: ${listSelection.selectedRowId}`);

    // First, get the automation flow data
    const db = getDb();
    const automationResult = await db.select({
      id: automations.id,
      name: automations.name,
      flowData: automations.flowData,
      userId: automations.userId
    })
      .from(automations)
      .where(eq(automations.id, automationId))
      .limit(1);

    if (!automationResult.length || !automationResult[0]) {
      console.error(`[Automation] ❌ Automation not found: ${automationId}`);
      return { success: false, error: 'Automation not found' };
    }

    const automation = automationResult[0];

    // Get the flow data
    const flowData = automation.flowData as FlowData;
    if (!flowData?.nodes || !Array.isArray(flowData.nodes)) {
      console.error(`[Automation] ❌ Invalid flow data`);
      return { success: false, error: 'Invalid flow data' };
    }

    // Find the list message node
    const listNode = flowData.nodes.find((n: FlowNode) => n.id === listSelection.nodeId);
    if (!listNode) {
      console.error(`[Automation] ❌ List message node not found: ${listSelection.nodeId}`);
      return { success: false, error: 'List message node not found' };
    }

    console.log(`[Automation] Found list node: ${listNode.id}, edges: ${flowData.edges?.length || 0}`);

    // Find edges connected FROM the list node
    const edgesFromListNode = (flowData.edges || []).filter((edge: FlowEdge) => edge.source === listSelection.nodeId);
    console.log(`[Automation] Edges from list node:`, edgesFromListNode.map((e: FlowEdge) => ({
      sourceHandle: e.sourceHandle,
      target: e.target,
      rowId: e.sourceHandle
    })));

    // Find the edge with sourceHandle matching the selected row
    let selectedEdge = null;

    // Try exact match first
    selectedEdge = edgesFromListNode.find((edge: FlowEdge) =>
      edge.sourceHandle === listSelection.selectedRowId
    );

    // If not found, try matching by row ID pattern
    if (!selectedEdge) {
      console.log(`[Automation] No exact match for ${listSelection.selectedRowId}, trying pattern match...`);

      // Look for edges with sourceHandle containing the row ID
      selectedEdge = edgesFromListNode.find((edge: FlowEdge) => {
        if (!edge.sourceHandle) return false;

        // Handle different edge ID patterns
        const sourceHandle = edge.sourceHandle.toLowerCase();
        const rowId = listSelection.selectedRowId.toLowerCase();

        return sourceHandle.includes(rowId) ||
          sourceHandle.includes(`row-${rowId}`) ||
          sourceHandle.includes(`row_${rowId}`);
      });
    }

    if (!selectedEdge) {
      console.error(`[Automation] ❌ No edge found for selected row: ${listSelection.selectedRowId}`);
      console.error(`[Automation] Available edges:`, edgesFromListNode.map((e: FlowEdge) => e.sourceHandle));
      return { success: false, error: 'No branch found for selected option' };
    }

    console.log(`[Automation] ✅ Found edge for selection:`, {
      sourceHandle: selectedEdge.sourceHandle,
      target: selectedEdge.target,
      targetNodeType: flowData.nodes.find((n: FlowNode) => n.id === selectedEdge.target)?.type
    });

    // Create a new execution ID for the continuation
    const continuationExecutionId = `exec-continue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get user
    const userResult = await db.select({
      id: users.id,
      email: users.email,
      whatsappPhoneNumberId: users.whatsappPhoneNumberId,
      whatsappAccessToken: users.whatsappAccessToken,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult.length || !userResult[0]) {
      console.error(`[Automation] ❌ User not found: ${userId}`);
      return { success: false, error: 'User not found' };
    }

    const user = userResult[0];

    // Get contact
    const contactResult = await db.select({
      id: contacts.id,
      phone: contacts.phone,
      name: contacts.name,
      email: contacts.email,
      tagIds: contacts.tagIds
    })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (!contactResult.length || !contactResult[0]) {
      console.error(`[Automation] ❌ Contact not found: ${contactId}`);
      return { success: false, error: 'Contact not found' };
    }

    const contact = contactResult[0];

    // Get conversation from the original list message
let conversation = null;
if (listSelection.messageId) {
  const messageResult = await db.select({
    conversationId: messages.conversationId
  })
    .from(messages)
    .where(eq(messages.id, listSelection.messageId))
    .limit(1);

  if (messageResult.length && messageResult[0]) {
    const conversationId = messageResult[0].conversationId;
    
    // ADD THIS NULL CHECK
    if (conversationId) {
      const conversationResult = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (conversationResult.length && conversationResult[0]) {
        conversation = conversationResult[0];
      }
    }
  }
}

    // Create execution context for continuation
    const context: ExecutionContext = {
      contactId: contact.id,
      workflowId: automation.id,
      executionId: continuationExecutionId,
      currentData: {
        contact,
        user,
        conversation,
        triggerData: {
          listSelection: listSelection,
          isContinuation: true,
        },
        variables: {},
        // Store the selection info
        listSelection: {
          selectedRowId: listSelection.selectedRowId,
          selectedRowTitle: selectedEdge.sourceHandle,
          originalNodeId: listSelection.nodeId,
        }
      },
      userData: user
    };

    // Now execute starting from the TARGET node of the selected edge
    const nodeMap = new Map<string, FlowNode>(flowData.nodes.map((n: FlowNode) => [n.id, n]));
    const edgeMap = new Map<string, FlowEdge[]>();

    (flowData.edges || []).forEach((edge: FlowEdge) => {
      if (!edgeMap.has(edge.source)) {
        edgeMap.set(edge.source, []);
      }
      edgeMap.get(edge.source)!.push(edge);
    });

    // Start execution from the TARGET node of the selected edge
    let currentNode = nodeMap.get(selectedEdge.target);

    if (!currentNode) {
      console.error(`[Automation] ❌ Target node not found: ${selectedEdge.target}`);
      return { success: false, error: 'Target node not found' };
    }

    console.log(`[Automation] 🚀 Starting continuation from node: ${currentNode.id} (${currentNode.type})`);

    let executionCount = 0;
    const maxExecutions = 50; // Safety limit for continuation
    const nodeExecutions: any[] = [];
    const visitedNodes = new Set<string>();

    // Track that we came from a list selection
    visitedNodes.add(listSelection.nodeId);

    // Execution loop for continuation
    while (currentNode && executionCount < maxExecutions) {
      executionCount++;

      // Skip if already visited (prevents loops)
      if (visitedNodes.has(currentNode.id)) {
        console.log(`[Automation] ⚠️ Already visited ${currentNode.id}, stopping continuation`);
        break;
      }

      visitedNodes.add(currentNode.id);

      console.log(`[Automation] ➡️ Processing continuation node: ${currentNode.id} (${currentNode.type})`);

      const nodeStartTime = Date.now();
      let nodeSuccess = false;
      let nodeError: string | null = null;
      let conditionResult: boolean | null = null;
      let keywordResult: boolean | null = null;

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
            keywordResult = keywordResponse.matched;
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

          case 'listMessageNode':
            console.log(`[Automation] 📋 Executing list message node`);
            const listResponse = await this.executeListMessageNode(currentNode, context);
            nodeSuccess = listResponse.success;

            // If we're sending a NEW list message, check if we need to pause
            if (listResponse.pendingSelection) {
              // Store pending selection and pause execution
              context.currentData.pendingListSelection = listResponse.pendingSelection;
              console.log(`[Automation] List message sent, waiting for user selection`);

              // Save execution record and PAUSE
              nodeExecutions.push({
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                success: nodeSuccess,
                error: nodeError,
                duration: Date.now() - nodeStartTime,
                timestamp: new Date(),
                pendingSelection: true,
                listMessageId: listResponse.sentMessageId,
              });

              // Save and pause execution
              await this.saveExecutionRecord({
                automationId,
                contactId,
                userId,
                status: 'pending_selection',
                triggerData: {
                  listSelection: listSelection,
                  isContinuation: true,
                },
                nodeExecutions,
                executionData: context,
                startedAt: new Date(),
                completedAt: new Date(),
              });

              console.log(`[Automation] ⏸️ Execution paused, waiting for user selection`);
              return { success: true, executionId: continuationExecutionId };
            }
            break;

          case 'interactiveMessageNode':
            console.log(`[Automation] 🎮 Executing interactive message node`);
            const interactiveResponse = await this.executeInteractiveMessageNode(currentNode, context);
            nodeSuccess = interactiveResponse.success;

            // If we're sending an interactive message, check if we need to pause
            if (interactiveResponse.pendingAction) {
              // Store pending action and pause execution
              context.currentData.pendingInteractiveAction = interactiveResponse.pendingAction;
              console.log(`[Automation] Interactive message sent, waiting for user action`);

              // Save execution record and PAUSE
              nodeExecutions.push({
                nodeId: currentNode.id,
                nodeType: currentNode.type,
                success: nodeSuccess,
                error: nodeError,
                duration: Date.now() - nodeStartTime,
                timestamp: new Date(),
                pendingAction: true,
                interactiveMessageId: interactiveResponse.sentMessageId,
              });

              // Save and pause execution
              await this.saveExecutionRecord({
                automationId,
                contactId,
                userId,
                status: 'pending_action',
                triggerData: {
                  listSelection: listSelection,
                  isContinuation: true,
                },
                nodeExecutions,
                executionData: context,
                startedAt: new Date(),
                completedAt: new Date(),
              });

              console.log(`[Automation] ⏸️ Execution paused, waiting for user action`);
              return { success: true, executionId: continuationExecutionId };
            }
            break;
          default:
            console.log(`[Automation] ⚠️ Unknown node type in continuation: ${currentNode.type}`);
            nodeSuccess = true;
        }
      } catch (error: any) {
        nodeError = error.message;
        console.error(`[Automation] ❌ Error in continuation node ${currentNode.id}:`, error);
      }

      nodeExecutions.push({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        success: nodeSuccess,
        error: nodeError,
        duration: Date.now() - nodeStartTime,
        timestamp: new Date(),
        conditionResult,
        keywordResult,
      });

      // Determine next node based on edges
      const outgoingEdges = edgeMap.get(currentNode.id) || [];

      if (outgoingEdges.length === 0) {
        console.log(`[Automation] 🏁 No outgoing edges from ${currentNode.id}, continuation complete`);
        break;
      }

      // Handle keyword action node branching
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
          nextEdge = outgoingEdges[0];
          console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
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
          nextEdge = outgoingEdges[0];
          console.log(`[Automation] ↪️ No matching branch, following first edge to ${nextEdge?.target}`);
        }

        if (nextEdge) {
          currentNode = nodeMap.get(nextEdge.target);
          continue;
        }
      }

      // For regular nodes, follow the first outgoing edge
      if (outgoingEdges.length > 0) {
        const nextEdge = outgoingEdges[0];
        currentNode = nodeMap.get(nextEdge?.target || '');
      } else {
        currentNode = undefined;
      }
    }

    if (executionCount >= maxExecutions) {
      console.warn(`[Automation] ⚠️ Continuation stopped: reached maximum execution limit (${maxExecutions} nodes)`);
    }

    // Save continuation execution record
    await this.saveExecutionRecord({
      automationId,
      contactId,
      userId,
      status: 'completed',
      triggerData: {
        listSelection: listSelection,
        isContinuation: true,
      },
      nodeExecutions: [
        {
          nodeId: listSelection.nodeId,
          nodeType: 'listMessageNode',
          success: true,
          duration: 0,
          timestamp: new Date(),
          listSelection: listSelection.selectedRowId,
        },
        ...nodeExecutions
      ],
      executionData: context,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    console.log(`[Automation] ✅ Continuation completed: ${continuationExecutionId}`);
    console.log(`[Automation] Processed ${executionCount} continuation nodes`);

    return { success: true, executionId: continuationExecutionId };
  }

  /**
   * Get execution runs for an automation
   */
  async getAutomationRuns(automationId: string, userId: string, page = 1, limit = 20) {
    try {
      const db = getDb();
      const offset = (page - 1) * limit;

      // Verify automation belongs to user
      const automationResult = await db
        .select()
        .from(automations)
        .where(and(
          eq(automations.id, automationId),
          eq(automations.userId, userId)
        ));

      if (!automationResult.length || !automationResult[0]) {
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

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId));

      const total = totalResult[0]?.count || 0;

      return {
        success: true,
        data: runs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Error fetching automation runs:', error);
      return {
        success: false,
        error: 'Failed to fetch automation runs',
      };
    }
  }
}

export const automationExecutionService = new AutomationExecutionService();