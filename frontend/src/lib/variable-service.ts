export class VariableService {
  /**
   * Replace variables in a template string with actual values
   */
  static replaceVariables(
    template: string,
    context: {
      contact?: any;
      user?: any;
      conversation?: any;
    }
  ): string {
    if (!template) return template;
    
    const now = new Date();
    const contactName = context.contact?.name || '';
    const userName = context.user?.name || '';
    
    // Build variables object
    const variables: Record<string, string> = {
      // Contact variables
      '{{contact.name}}': contactName,
      '{{contact.firstName}}': contactName.split(' ')[0] || '',
      '{{contact.lastName}}': contactName.split(' ').slice(1).join(' ') || '',
      '{{contact.lastname}}': contactName.split(' ').slice(1).join(' ') || '', // alias
      '{{contact.phone}}': context.contact?.phone || '',
      '{{contact.email}}': context.contact?.email || '',
      '{{contact.city}}': context.contact?.city || '',
      '{{contact.country}}': context.contact?.country || '',
      '{{contact.status}}': context.contact?.status || '',
      '{{contact.tags}}': Array.isArray(context.contact?.tags) 
        ? context.contact.tags.join(', ') 
        : '',
      
      // User/Agent variables
      '{{user.name}}': userName,
      '{{user.firstName}}': userName.split(' ')[0] || '',
      '{{user.lastName}}': userName.split(' ').slice(1).join(' ') || '',
      '{{user.email}}': context.user?.email || '',
      '{{user.company}}': context.user?.companyName || 'Our Company',
      
      // Date/time variables (client-side - always current)
      '{{date.today}}': now.toLocaleDateString(),
      '{{date.current}}': now.toLocaleDateString(),
      '{{time.current}}': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '{{time.now}}': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '{{day.today}}': now.toLocaleDateString('en-US', { weekday: 'long' }),
      '{{date.time}}': `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      '{{date.year}}': now.getFullYear().toString(),
      '{{date.month}}': (now.getMonth() + 1).toString(),
      '{{date.day}}': now.getDate().toString(),
      '{{date.hour}}': now.getHours().toString().padStart(2, '0'),
      '{{date.minute}}': now.getMinutes().toString().padStart(2, '0'),
      
      // Conversation variables
      '{{conversation.id}}': context.conversation?.id || '',
      '{{conversation.status}}': context.conversation?.status || '',
      '{{conversation.unreadCount}}': String(context.conversation?.unreadCount || 0),
      
      // Company variables (from environment or defaults)
      '{{company.name}}': 'Our Company', // Could be from env or user settings
      '{{company.phone}}': '',
      '{{company.email}}': '',
      '{{company.website}}': '',
    };
    
    // Perform replacement
    let result = template;
    for (const [placeholder, value] of Object.entries(variables)) {
      if (result.includes(placeholder)) {
        // Escape special regex characters in placeholder
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
      }
    }
    
    return result;
  }

  /**
   * Extract variables from a template (for display/debugging)
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];
    
    const regex = /\{\{(\w+(?:\.\w+)?)\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map(match => match[1]))];
  }

  /**
   * Get list of available variables (for UI help)
   */
  static getAvailableVariables(): Array<{
    placeholder: string;
    description: string;
    example: string;
  }> {
    return [
      { placeholder: '{{contact.name}}', description: "Contact's full name", example: "John Doe" },
      { placeholder: '{{contact.firstName}}', description: "Contact's first name", example: "John" },
      { placeholder: '{{contact.lastName}}', description: "Contact's last name", example: "Doe" },
      { placeholder: '{{contact.phone}}', description: "Contact's phone number", example: "+1234567890" },
      { placeholder: '{{contact.email}}', description: "Contact's email", example: "john@example.com" },
      { placeholder: '{{contact.city}}', description: "Contact's city", example: "New York" },
      { placeholder: '{{contact.country}}', description: "Contact's country", example: "USA" },
      { placeholder: '{{user.name}}', description: "Your full name", example: "Jane Smith" },
      { placeholder: '{{user.firstName}}', description: "Your first name", example: "Jane" },
      { placeholder: '{{date.today}}', description: "Today's date", example: "16/12/2025" },
      { placeholder: '{{time.now}}', description: "Current time", example: "21:30" },
      { placeholder: '{{day.today}}', description: "Today's day", example: "Tuesday" },
      { placeholder: '{{company.name}}', description: "Your company name", example: "Our Company" },
    ];
  }
}