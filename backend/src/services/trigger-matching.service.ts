// backend/src/services/trigger-matching.service.ts
import { getDb } from '../db/client';
import { automations } from '../db/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { TRIGGER_TYPES, TriggerType } from './types/triggers';

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
      
    } catch (error) {
      console.error('[Trigger] Error checking first message:', error);
      return false;
    }
  }
}

export const triggerMatchingService = new TriggerMatchingService();