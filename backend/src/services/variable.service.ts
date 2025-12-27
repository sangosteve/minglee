//backend/src/services/variable.service.ts
export class VariableService {
  /**
   * Replace variables in a template string with actual values
   */
  static replaceVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    if (!template) {
      return template;
    }

    let result = template;
    
    // Replace each variable
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      if (result.includes(placeholder)) {
        result = result.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), String(value || ''));
      }
    }
    
    return result;
  }

  // Helper method to escape regex special characters
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get available variables for a conversation context
   */
  static getAvailableVariables(conversation: any, contact: any, user: any): Record<string, any> {
    const now = new Date();
    
    // Extract name parts
    let contactFirstName = '';
    let contactLastName = '';
    if (contact?.name) {
      const nameParts = contact.name.split(' ');
      contactFirstName = nameParts[0] || '';
      contactLastName = nameParts.slice(1).join(' ') || '';
    }
    
    let userFirstName = '';
    let userLastName = '';
    if (user?.name) {
      const nameParts = user.name.split(' ');
      userFirstName = nameParts[0] || '';
      userLastName = nameParts.slice(1).join(' ') || '';
    }
    
    return {
      // Contact variables
      'contact.name': contact?.name || '',
      'contact.firstName': contactFirstName,
      'contact.lastName': contactLastName,
      'contact.lastname': contactLastName, // Alias
      'contact.phone': contact?.phone || '',
      'contact.email': contact?.email || '',
      'contact.city': contact?.city || '',
      'contact.country': contact?.country || '',
      'contact.status': contact?.status || '',
      'contact.tags': contact?.tags ? contact.tags.join(', ') : '',
      
      // User/Agent variables
      'user.name': user?.name || '',
      'user.firstName': userFirstName,
      'user.lastName': userLastName,
      'user.email': user?.email || '',
      'user.company': user?.companyName || 'Our Company',
      
      // Date/time variables
      'date.today': now.toLocaleDateString(),
      'date.current': now.toLocaleDateString(),
      'time.current': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'day.today': now.toLocaleDateString('en-US', { weekday: 'long' }),
      'date.time': `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      'time.now': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'date.year': now.getFullYear().toString(),
      'date.month': (now.getMonth() + 1).toString(),
      'date.day': now.getDate().toString(),
      'date.hour': now.getHours().toString().padStart(2, '0'),
      'date.minute': now.getMinutes().toString().padStart(2, '0'),
      
      // Conversation variables
      'conversation.id': conversation?.id || '',
      'conversation.status': conversation?.status || '',
      'conversation.unreadCount': conversation?.unreadCount || 0,
      
      // Company variables (customize these as needed)
      'company.name': process.env.COMPANY_NAME || 'Our Company',
      'company.phone': process.env.COMPANY_PHONE || '',
      'company.email': process.env.COMPANY_EMAIL || '',
      'company.website': process.env.COMPANY_WEBSITE || '',
    };
  }

  /**
   * Extract all variables from a template
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];
    
    const regex = /\{\{([^{}]+)\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map(match => match[1].trim()))];
  }

  /**
   * Get all available variable names (for UI display)
   */
  static getAvailableVariableNames(): string[] {
    return [
      // Contact variables
      'contact.name',
      'contact.firstName',
      'contact.lastName',
      'contact.phone',
      'contact.email',
      'contact.city',
      'contact.country',
      'contact.status',
      'contact.tags',
      
      // User/Agent variables
      'user.name',
      'user.firstName',
      'user.lastName',
      'user.email',
      'user.company',
      
      // Date/time variables
      'date.today',
      'date.current',
      'time.current',
      'day.today',
      'date.time',
      'time.now',
      'date.year',
      'date.month',
      'date.day',
      'date.hour',
      'date.minute',
      
      // Conversation variables
      'conversation.id',
      'conversation.status',
      'conversation.unreadCount',
      
      // Company variables
      'company.name',
      'company.phone',
      'company.email',
      'company.website',
    ];
  }
}