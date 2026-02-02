// backend/src/services/trigger-matching.service.ts
import { getDb } from '../db/client';
import { automations } from '../db/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';

// Define trigger types inline since the module doesn't exist
export type TriggerType = 'new_conversation' | 'message_received' | 'keyword';

export const TRIGGER_TYPES: { value: TriggerType; label: string; description: string }[] = [
  { value: 'new_conversation', label: 'New Conversation', description: 'Triggers when a contact messages for the first time' },
  { value: 'message_received', label: 'Message Received', description: 'Triggers on any incoming message' },
  { value: 'keyword', label: 'Keyword', description: 'Triggers when specific keywords are detected' }
];

export interface TriggerCheckResult {
  shouldExecute: boolean;
  matchedAutomation?: any;
  triggerType?: TriggerType;
  matchedKeywords?: string[];
}

export class TriggerMatchingService {
  /**
   * Check if any automation should be triggered for a message
   */
  async checkMessageTrigger(
    userId: string,
    contactId: string,
    phoneNumberId: string,
    message: string,
    isFirstMessage: boolean = false
  ): Promise<TriggerCheckResult[]> {
    const db = getDb();
    
    try {
      console.log(`[Trigger] Checking triggers for message: "${message}"`);
      console.log(`[Trigger] Is first message: ${isFirstMessage}`);
      
      // Get all active automations for this user
      const automationsList = await db.select()
        .from(automations)
        .where(
          and(
            eq(automations.userId, userId),
            eq(automations.status, 'active')
          )
        );
      
      console.log(`[Trigger] Found ${automationsList.length} active automations`);
      
      const results: TriggerCheckResult[] = [];
      
      for (const automation of automationsList) {
        const flowData = automation.flowData as any;
        if (!flowData || !flowData.nodes) continue;
        
        // Find the trigger node in this automation
        const triggerNode = flowData.nodes.find((node: any) => node.type === 'triggerNode');
        if (!triggerNode) continue;
        
        const triggerData = triggerNode.data || {};
        const triggerType: TriggerType = triggerData.triggerType || 'new_conversation';
        const config = triggerData.config || {};
        
        console.log(`[Trigger] Checking automation "${automation.name}" with trigger type: ${triggerType}`);
        
        let shouldExecute = false;
        let matchedKeywords: string[] = [];
        
        switch (triggerType) {
          case 'new_conversation':
            shouldExecute = isFirstMessage;
            break;
            
          case 'message_received':
            shouldExecute = true; // Always trigger for any message
            break;
            
          case 'keyword':
            shouldExecute = this.checkKeywordMatch(message, config.keywords || [], {
              caseSensitive: config.caseSensitive || false,
              matchAll: config.matchAll || false
            });
            
            if (shouldExecute) {
              matchedKeywords = this.getMatchedKeywords(message, config.keywords || []);
            }
            break;
            
          default:
            console.warn(`[Trigger] Unknown trigger type: ${triggerType}`);
            continue;
        }
        
        if (shouldExecute) {
          console.log(`[Trigger] ✅ Automation "${automation.name}" should execute!`);
          results.push({
            shouldExecute: true,
            matchedAutomation: automation,
            triggerType,
            matchedKeywords
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('[Trigger] Error checking triggers:', error);
      return [];
    }
  }
  
  /**
   * Check if message matches keywords
   */
  private checkKeywordMatch(
    message: string,
    keywords: string[],
    options: {
      caseSensitive: boolean;
      matchAll: boolean;
    }
  ): boolean {
    if (keywords.length === 0) return false;
    
    const searchMessage = options.caseSensitive ? message : message.toLowerCase();
    const searchKeywords = options.caseSensitive ? keywords : keywords.map(k => k.toLowerCase());
    
    if (options.matchAll) {
      // ALL keywords must match
      return searchKeywords.every(keyword => 
        searchMessage.includes(keyword.trim())
      );
    } else {
      // ANY keyword can match
      return searchKeywords.some(keyword => 
        searchMessage.includes(keyword.trim())
      );
    }
  }
  
  /**
   * Get which keywords matched
   */
  private getMatchedKeywords(
    message: string,
    keywords: string[]
  ): string[] {
    const matched: string[] = [];
    const searchMessage = message.toLowerCase();
    
    for (const keyword of keywords) {
      if (searchMessage.includes(keyword.toLowerCase().trim())) {
        matched.push(keyword);
      }
    }
    
    return matched;
  }
  
  /**
   * Check if a contact is messaging for the first time
   */
  async isFirstMessage(
    userId: string,
    contactId: string,
    phoneNumberId: string
  ): Promise<boolean> {
    const db = getDb();
    
    try {
      // Check if there are any previous messages from this contact
      // Note: You need to have messages and conversations tables
      try {
        const previousMessages = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.contact_id = ${contactId}
          AND c.user_id = ${userId}
          AND c.whatsapp_phone_number_id = ${phoneNumberId}
          AND m.direction = 'incoming'
        `);
        
        const count = previousMessages.rows[0]?.count || 0;
        return count === 0;
      } catch (tableError) {
        // If tables don't exist yet, assume it's the first message
        console.warn('[Trigger] Messages/conversations tables not found, assuming first message');
        return true;
      }
      
    } catch (error) {
      console.error('[Trigger] Error checking first message:', error);
      return false;
    }
  }

  /**
   * Check time-based triggers (for future implementation)
   */
  async checkTimeTrigger(
    userId: string,
    automationId: string
  ): Promise<boolean> {
    // TODO: Implement time-based triggers (e.g., "send at specific time", "after X days")
    return false;
  }

  /**
   * Check event-based triggers (for future implementation)
   */
  async checkEventTrigger(
    userId: string,
    eventType: string,
    eventData: any
  ): Promise<TriggerCheckResult[]> {
    // TODO: Implement event-based triggers (e.g., "contact tagged", "form submitted")
    return [];
  }

  /**
   * Validate trigger configuration
   */
  validateTriggerConfig(
    triggerType: TriggerType,
    config: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (triggerType) {
      case 'keyword':
        if (!config.keywords || !Array.isArray(config.keywords) || config.keywords.length === 0) {
          errors.push('At least one keyword is required for keyword triggers');
        }
        if (config.keywords && config.keywords.some((k: string) => k.trim().length === 0)) {
          errors.push('Keywords cannot be empty');
        }
        break;

      case 'new_conversation':
        // No specific config needed
        break;

      case 'message_received':
        // No specific config needed
        break;

      default:
        errors.push(`Unknown trigger type: ${triggerType}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get trigger description for display
   */
  getTriggerDescription(triggerType: TriggerType, config?: any): string {
    const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
    let description = trigger?.description || 'Unknown trigger';
    
    if (triggerType === 'keyword' && config?.keywords) {
      const keywords = config.keywords.join(', ');
      description += ` (Keywords: ${keywords})`;
    }
    
    return description;
  }

  /**
   * Get all trigger types for UI dropdown
   */
  getTriggerTypes(): { value: TriggerType; label: string; description: string }[] {
    return TRIGGER_TYPES;
  }
}

export const triggerMatchingService = new TriggerMatchingService();