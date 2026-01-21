//backend/src/utils/whatsapp-utils.ts
/**
 * WhatsApp Template Utilities
 */

/**
 * Validates template parameters before sending
 */
// backend/src/utils/whatsapp-utils.ts
export function validateTemplateParameters(template: any, parameters: any): string[] {
  const errors: string[] = [];
  
  if (!parameters) {
    errors.push('Parameters object is required');
    return errors;
  }
  
  // Check required variables
  const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
  
  // Check for NAMED parameters (new WhatsApp format)
  if (bodyComponent?.example?.body_text_named_params) {
    const namedParams = bodyComponent.example.body_text_named_params;
    
    console.log(`🔍 Found ${namedParams.length} named parameters in template:`, 
      namedParams.map((p: any) => p.param_name));
    
    // Check each named parameter
    for (const param of namedParams) {
      const paramName = param.param_name;
      const value = parameters.variables?.[paramName];
      
      if ((value === undefined || value === null || value === '') && (!param.example || param.example.trim() === '')) {
        errors.push(`Missing required parameter: "${paramName}"`);
      } else if (value && typeof value !== 'string') {
        errors.push(`Parameter "${paramName}" must be a string`);
      } else if (value && value.length > 32768) {
        errors.push(`Parameter "${paramName}" exceeds maximum length (32768 characters)`);
      }
    }
  }
  // Check for NUMBERED parameters (positional/old format - YOUR CASE)
  else if (bodyComponent?.example?.body_text) {
    const positionGroups = bodyComponent.example.body_text;
    if (positionGroups && positionGroups.length > 0) {
      const exampleGroup = positionGroups[0];
      
      console.log(`🔍 Found ${exampleGroup.length} numbered parameters in template`);
      
      // Check each positional parameter (0, 1, 2, 3...)
      for (let i = 0; i < exampleGroup.length; i++) {
        const value = parameters.variables?.[i.toString()];
        const example = exampleGroup[i];
        
        console.log(`  Checking position ${i}: value="${value}", example="${example}"`);
        
        if ((value === undefined || value === null || value === '') && (!example || example.trim() === '')) {
          errors.push(`Missing required parameter at position ${i}`);
        } else if (value && typeof value !== 'string') {
          errors.push(`Parameter at position ${i} must be a string`);
        } else if (value && value.length > 32768) {
          errors.push(`Parameter at position ${i} exceeds maximum length (32768 characters)`);
        }
      }
    }
  }
  // Fallback: Extract variables from {{pattern}} in text
  else if (bodyComponent?.text) {
    const matches = bodyComponent.text.match(/\{\{(\w+)\}\}/g) || [];
    const variableNames = matches.map((match: string) => 
      match.replace(/\{\{|\}\}/g, '')
    );
    
    console.log(`🔍 Found ${variableNames.length} variables in text pattern:`, variableNames);
    
    // Check each variable found in the text
    for (const varName of variableNames) {
      const value = parameters.variables?.[varName];
      
      if (value === undefined || value === null || value === '') {
        errors.push(`Missing required parameter: "${varName}"`);
      } else if (typeof value !== 'string') {
        errors.push(`Parameter "${varName}" must be a string`);
      } else if (value.length > 32768) {
        errors.push(`Parameter "${varName}" exceeds maximum length (32768 characters)`);
      }
    }
  } else {
    console.log('⚠️ No parameter information found in template body');
  }
  
  // Check for extra parameters not in template
  if (parameters.variables && parameters.variables.length > 0) {
    let templateParamNames: string[] = [];
    
    // Collect parameter names based on template format
    if (bodyComponent?.example?.body_text_named_params) {
      // Named parameters
      templateParamNames = bodyComponent.example.body_text_named_params.map((p: any) => p.param_name);
      console.log('📋 Template expects named parameters:', templateParamNames);
    } else if (bodyComponent?.example?.body_text) {
      // Numbered parameters (0, 1, 2, 3...)
      const positionGroups = bodyComponent.example.body_text;
      if (positionGroups && positionGroups.length > 0) {
        const exampleGroup = positionGroups[0];
        templateParamNames = exampleGroup.map((_: any, index: number) => index.toString());
        console.log('📋 Template expects numbered parameters:', templateParamNames);
      }
    } else if (bodyComponent?.text) {
      // Variables from text pattern
      const matches = bodyComponent.text.match(/\{\{(\w+)\}\}/g) || [];
      templateParamNames = matches.map((match: string) => 
        match.replace(/\{\{|\}\}/g, '')
      );
      console.log('📋 Template expects variables from text:', templateParamNames);
    }
    
    const providedParamNames = Object.keys(parameters.variables);
    console.log('📋 Provided parameters:', providedParamNames);
    
    const extraParams = providedParamNames.filter(name => !templateParamNames.includes(name));
    
    if (extraParams.length > 0) {
      errors.push(`Extra parameters provided: ${extraParams.join(', ')}. Expected parameters: ${templateParamNames.length > 0 ? templateParamNames.join(', ') : 'none'}`);
    }
  }
  
  // Validate media for header
  const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
  if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format || '')) {
    if (!parameters.media?.url) {
      errors.push(`${headerComponent.format} header requires media file`);
    } else {
      // Validate URL format
      try {
        const url = new URL(parameters.media.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('Media URL must use http or https protocol');
        }
      } catch {
        errors.push('Media URL is not valid');
      }
      
      // Validate media type matches header format
      const mediaType = parameters.media.type?.toLowerCase();
      const expectedType = headerComponent.format?.toLowerCase();
      
      if (mediaType && expectedType && mediaType !== expectedType) {
        errors.push(`Media type mismatch. Expected: ${expectedType}, Got: ${mediaType}`);
      }
      
      // Validate caption length if provided
      if (parameters.media.caption && parameters.media.caption.length > 3000) {
        errors.push('Media caption exceeds maximum length of 3000 characters');
      }
    }
  }
  
  // Validate variable count matches template
  let expectedVariableCount = 0;
  
  if (bodyComponent?.example?.body_text_named_params) {
    expectedVariableCount = bodyComponent.example.body_text_named_params.length;
  } else if (bodyComponent?.example?.body_text) {
    const positionGroups = bodyComponent.example.body_text;
    if (positionGroups && positionGroups.length > 0) {
      expectedVariableCount = positionGroups[0].length;
    }
  } else if (bodyComponent?.text) {
    const matches = bodyComponent.text.match(/\{\{(\w+)\}\}/g) || [];
    expectedVariableCount = matches.length;
  }
  
  const actualVariableCount = Object.keys(parameters.variables || {}).length;
  
  if (expectedVariableCount > 0 && actualVariableCount !== expectedVariableCount) {
    errors.push(`Parameter count mismatch. Expected: ${expectedVariableCount}, Got: ${actualVariableCount}`);
  }
  
  console.log(`✅ Validation complete. ${errors.length} errors found.`);
  
  return errors;
}


export function renderTemplateWithParameters(
  templateComponents: any[],
  parameters: any
): string {
  // Find the BODY component
  const bodyComponent = templateComponents.find((c: any) => c.type === 'BODY');
  
  if (!bodyComponent?.text) {
    return `[Template: No body text found]`;
  }

  let renderedText = bodyComponent.text;
  
  // Replace {{1}}, {{2}}, {{3}}, {{4}} with actual values
  if (parameters?.variables) {
    // Handle numbered parameters ({{1}}, {{2}}, etc.)
    for (let i = 1; i <= 10; i++) { // Check up to 10 parameters
      const placeholder = `{{${i}}}`;
      if (renderedText.includes(placeholder)) {
        const value = parameters.variables[i.toString()] || parameters.variables[i] || '';
        renderedText = renderedText.replace(new RegExp(placeholder, 'g'), value);
      }
    }
    
    // Handle named parameters ({{event_name}}, etc.)
    const namedMatches = renderedText.match(/\{\{(\w+)\}\}/g) || [];
    for (const match of namedMatches) {
      const paramName = match.replace(/\{\{|\}\}/g, '');
      const value = parameters.variables[paramName] || '';
      renderedText = renderedText.replace(new RegExp(match, 'g'), value);
    }
  }

  return renderedText;
}

/**
 * Formats phone number to E.164 format
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Add + if not present
  if (digits.startsWith('0')) {
    // Handle local numbers (assuming US/Canada)
    return `+1${digits.substring(1)}`;
  }
  
  return `+${digits}`;
}

/**
 * Validates E.164 phone number format
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Validates template name format
 */
export function validateTemplateName(name: string): boolean {
  const nameRegex = /^[a-z0-9_]+$/;
  return nameRegex.test(name) && name.length > 0 && name.length <= 512;
}

/**
 * Validates text length for WhatsApp limits
 */
export function validateTextLength(text: string, maxLength: number = 32768): boolean {
  return text.length > 0 && text.length <= maxLength;
}

/**
 * Validates media URL
 */
export function validateMediaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Extracts variables from template text
 */
export function extractVariablesFromText(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
}

/**
 * Formats language code for WhatsApp
 */
export function formatLanguageCode(language: string): string {
  if (language.includes('_')) {
    return language;
  }
  
  // Map common language codes
  const languageMap: Record<string, string> = {
    'en': 'en_US',
    'es': 'es_ES',
    'fr': 'fr_FR',
    'de': 'de_DE',
    'it': 'it_IT',
    'pt': 'pt_BR',
    'ru': 'ru_RU',
    'ar': 'ar_AR',
    'hi': 'hi_IN',
    'ja': 'ja_JP',
    'ko': 'ko_KR',
    'zh': 'zh_CN',
  };
  
  return languageMap[language] || `${language}_${language.toUpperCase()}`;
}

/**
 * Creates a WhatsApp template parameter
 */
export function createTemplateParameter(
  type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document',
  value: any
): any {
  switch (type) {
    case 'text':
      return {
        type: 'text',
        text: String(value).substring(0, 32768)
      };
      
    case 'currency':
      return {
        type: 'currency',
        currency: {
          fallback_value: `$${Number(value).toFixed(2)}`,
          code: 'USD',
          amount_1000: Math.round(Number(value) * 1000)
        }
      };
      
    case 'date_time':
      return {
        type: 'date_time',
        date_time: {
          fallback_value: new Date(value).toISOString()
        }
      };
      
    case 'image':
    case 'video':
    case 'document':
      return {
        type,
        [type]: {
          link: value.url,
          ...(value.caption ? { caption: value.caption.substring(0, 3000) } : {}),
          ...(value.filename ? { filename: value.filename } : {})
        }
      };
      
    default:
      return {
        type: 'text',
        text: String(value).substring(0, 32768)
      };
  }
}

/**
 * Validates template components before sending
 */
export function validateTemplateComponents(components: any[]): string[] {
  const errors: string[] = [];
  
  // Count buttons
  const buttons = components.filter(c => c.type === 'BUTTONS');
  if (buttons.length > 1) {
    errors.push('Only one BUTTONS component allowed');
  }
  
  // Check button count
  buttons.forEach(button => {
    if (button.buttons && button.buttons.length > 10) {
      errors.push('Maximum 10 buttons allowed');
    }
    
    // Check quick reply count
    const quickReplies = button.buttons?.filter((b: any) => b.type === 'QUICK_REPLY');
    if (quickReplies && quickReplies.length > 3) {
      errors.push('Maximum 3 quick reply buttons allowed');
    }
  });
  
  // Check header format
  const headers = components.filter(c => c.type === 'HEADER');
  headers.forEach(header => {
    if (header.format && !['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)) {
      errors.push(`Invalid header format: ${header.format}`);
    }
  });
  
  return errors;
}

/**
 * Debug function to log template details
 */
export function debugTemplate(template: any, parameters: any): void {
  console.log('🔍 Template Debug Information:');
  console.log('Template Name:', template.name);
  console.log('Template Language:', template.language);
  console.log('Meta Template ID:', template.metaTemplateId);
  console.log('WhatsApp Template ID:', template.whatsappTemplateId);
  console.log('Status:', template.status);
  console.log('Meta Status:', template.metaStatus);
  
  console.log('\n📋 Components:');
  template.components?.forEach((comp: any, index: number) => {
    console.log(`  ${index + 1}. ${comp.type}${comp.format ? ` (${comp.format})` : ''}`);
    if (comp.text) {
      console.log(`     Text: ${comp.text.substring(0, 100)}...`);
    }
    if (comp.example) {
      console.log(`     Example: ${JSON.stringify(comp.example).substring(0, 100)}...`);
    }
    if (comp.buttons) {
      console.log(`     Buttons: ${comp.buttons.length}`);
    }
  });
  
  console.log('\n📊 Parameters to send:');
  console.log('Variables:', parameters?.variables ? Object.keys(parameters.variables) : 'None');
  console.log('Has Media:', !!parameters?.media);
  if (parameters?.media) {
    console.log('Media URL:', parameters.media.url?.substring(0, 100) + '...');
    console.log('Media Type:', parameters.media.type);
  }
}