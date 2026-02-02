// backend/src/services/whatsapp-template.service.ts
import axios from 'axios';

// ============================================================================
// TYPE DEFINITIONS - UPDATED TO MATCH GUIDELINES
// ============================================================================

// Valid WhatsApp language codes from guidelines
export type WhatsAppLanguageCode = 
  | 'af' | 'sq' | 'ar' | 'az' | 'bn' | 'bg' | 'ca' | 'zh_CN' | 'zh_HK' | 'zh_TW'
  | 'hr' | 'cs' | 'da' | 'nl' | 'en' | 'en_GB' | 'en_US' | 'et' | 'fil' | 'fi'
  | 'fr' | 'ka' | 'de' | 'el' | 'gu' | 'ha' | 'he' | 'hi' | 'hu' | 'id' | 'ga'
  | 'it' | 'ja' | 'kn' | 'kk' | 'rw_RW' | 'ko' | 'ky_KG' | 'lo' | 'lv' | 'lt'
  | 'mk' | 'ms' | 'ml' | 'mr' | 'nb' | 'fa' | 'pl' | 'pt_BR' | 'pt_PT' | 'pa'
  | 'ro' | 'ru' | 'sr' | 'sk' | 'sl' | 'es' | 'es_AR' | 'es_ES' | 'es_MX' | 'sw'
  | 'sv' | 'ta' | 'te' | 'th' | 'tr' | 'uk' | 'ur' | 'uz' | 'vi' | 'zu';

export type ComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type ButtonType = 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
export type ParameterType = 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';

// Parameter structures from guidelines
export interface TextParameter {
  type: 'text';
  text: string;
}

export interface ImageParameter {
  type: 'image';
  image: {
    link?: string;
    id?: string;
  };
}

export interface VideoParameter {
  type: 'video';
  video: {
    link?: string;
    id?: string;
  };
}

export interface DocumentParameter {
  type: 'document';
  document: {
    link?: string;
    id?: string;
    filename?: string;
  };
}

export type MessageParameter = TextParameter | ImageParameter | VideoParameter | DocumentParameter;

// Component structure for sending messages FROM GUIDELINES
export interface MessageComponent {
  type: ComponentType;
  parameters?: MessageParameter[];
  sub_type?: 'quick_reply' | 'url'; // For button components
  index?: number; // Button index (0-based)
}

// Template message structure FROM GUIDELINES
export interface SendTemplateMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: WhatsAppLanguageCode;
      policy?: 'deterministic';
    };
    components?: MessageComponent[];
  };
}

// WhatsApp API Response
export interface WhatsAppMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      details: string;
    };
    fbtrace_id?: string;
  };
}

// ============================================================================
// TEMPLATE MESSAGE BUILDER - UPDATED
// ============================================================================

export class WhatsAppTemplateBuilder {
  private message: SendTemplateMessageRequest;
  private components: Map<ComponentType, MessageComponent>;

  constructor() {
    this.message = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      type: 'template',
      to: '',
      template: {
        name: '',
        language: {
          code: 'en', // Default to 'en' as per guidelines
          policy: 'deterministic'
        }
      }
    };
    this.components = new Map();
  }

  /**
   * Sets the recipient phone number
   */
  public setRecipient(phoneNumber: string): this {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    if (!digits || digits.length < 8) {
      throw new Error('Invalid phone number');
    }
    this.message.to = `+${digits}`;
    return this;
  }

  /**
   * Sets the template name and language
   * Uses exact language code as per guidelines
   */
  public setTemplate(
    name: string,
    languageCode: string,
    policy: 'deterministic' = 'deterministic'
  ): this {
    // Normalize language code (simple version)
    let normalizedCode: WhatsAppLanguageCode;
    
    if (languageCode.includes('_')) {
      normalizedCode = languageCode as WhatsAppLanguageCode;
    } else {
      // Map common codes
      const map: Record<string, WhatsAppLanguageCode> = {
        'en': 'en',
        'es': 'es',
        'fr': 'fr',
        'de': 'de',
        'it': 'it',
        'pt': 'pt_BR',
        'ru': 'ru',
        'ar': 'ar',
        'hi': 'hi',
        'ja': 'ja',
        'ko': 'ko',
        'zh': 'zh_CN',
      };
      normalizedCode = map[languageCode] || 'en';
    }

    console.log(`🌐 Setting template: name="${name}", language="${normalizedCode}"`);

    this.message.template = {
      name,
      language: {
        code: normalizedCode,
        policy
      }
    };
    return this;
  }

  /**
   * Adds a text parameter to a component
   */
  public addTextParameter(componentType: ComponentType, text: string): this {
    const parameter: TextParameter = {
      type: 'text',
      text: text.substring(0, 32768)
    };

    this.addParameterToComponent(componentType, parameter);
    return this;
  }

  /**
   * Adds an image parameter to the header
   */
  public addImageHeader(url: string): this {
    const parameter: ImageParameter = {
      type: 'image',
      image: {
        link: url
      }
    };

    this.addParameterToComponent('HEADER', parameter);
    return this;
  }

  /**
   * Adds a video parameter to the header
   */
  public addVideoHeader(url: string): this {
    const parameter: VideoParameter = {
      type: 'video',
      video: {
        link: url
      }
    };

    this.addParameterToComponent('HEADER', parameter);
    return this;
  }

  /**
   * Adds a document parameter to the header
   */
  public addDocumentHeader(url: string, filename?: string): this {
    const parameter: DocumentParameter = {
      type: 'document',
      document: {
        link: url,
        ...(filename ? { filename } : {})
      }
    };

    this.addParameterToComponent('HEADER', parameter);
    return this;
  }

  /**
   * Adds a button component
   */
  public addButton(subType: 'quick_reply' | 'url', index: number, parameters?: TextParameter[]): this {
    const component: MessageComponent = {
      type: 'BUTTONS',
      sub_type: subType,
      index: index,
      ...(parameters ? { parameters } : {})
    };

    this.addComponent(component);
    return this;
  }

  /**
   * Adds a parameter to a specific component
   */
  private addParameterToComponent(componentType: ComponentType, parameter: MessageParameter): void {
    let component = this.components.get(componentType);

    if (!component) {
      component = {
        type: componentType,
        parameters: []
      };
      this.components.set(componentType, component);
    }

    if (!component.parameters) {
      component.parameters = [];
    }

    component.parameters.push(parameter);
  }

  /**
   * Adds a complete component to the message
   */
  private addComponent(component: MessageComponent): void {
    if (!this.message.template.components) {
      this.message.template.components = [];
    }

    this.message.template.components.push(component);
  }

  /**
   * Builds and returns the complete message
   */
  public build(): SendTemplateMessageRequest {
    // Add components from map to template
    if (this.components.size > 0) {
      if (!this.message.template.components) {
        this.message.template.components = [];
      }

      // Add components in order: header, body, footer, buttons
      const orderedTypes: ComponentType[] = ['HEADER', 'BODY', 'FOOTER'];
      
      for (const type of orderedTypes) {
        const component = this.components.get(type);
        if (component) {
          this.message.template.components.push(component);
        }
      }

      // Add button components (they might already be added via addComponent)
      const buttonsComponent = this.components.get('BUTTONS');
      if (buttonsComponent) {
        this.message.template.components.push(buttonsComponent);
      }
    }

    // Validate required fields
    if (!this.message.to) {
      throw new Error('Recipient phone number is required');
    }
    if (!this.message.template.name) {
      throw new Error('Template name is required');
    }

    console.log('✅ Template message built successfully');
    return this.message;
  }
}

// ============================================================================
// WHATSAPP TEMPLATE API CLIENT - UPDATED
// ============================================================================

export class WhatsAppTemplateAPIClient {
  private readonly baseUrl: string = 'https://graph.facebook.com';
  private readonly apiVersion: string = 'v20.0';

  /**
   * Converts your component format to WhatsApp format
   */
public convertComponentsToWhatsAppFormat(
  templateComponents: any[],
  parameters: {
    variables?: Record<string, any>;
    media?: { type: string; url: string; caption?: string; filename?: string };
  }
): MessageComponent[] {
  const whatsappComponents: MessageComponent[] = [];

  console.log('🔍 Converting components to WhatsApp format:', {
    componentCount: templateComponents.length,
    hasMedia: !!parameters?.media,
    variableCount: Object.keys(parameters?.variables || {}).length
  });

  // 1. Process HEADER component
  const headerComponent = templateComponents.find((c: any) => c.type === 'HEADER');
  if (headerComponent && parameters?.media) {
    console.log(`📋 Processing ${headerComponent.format} header`);
    
    const headerParams = this.buildHeaderParameters(headerComponent, parameters.media);
    if (headerParams.length > 0) {
      whatsappComponents.push({
        type: 'HEADER',
        parameters: headerParams
      });
    }
  }

  // 2. Process BODY component
  const bodyComponent = templateComponents.find((c: any) => c.type === 'BODY');
  if (bodyComponent && parameters?.variables) {
    console.log('📋 Processing BODY with variables');
    
    const bodyParams = this.buildBodyParameters(bodyComponent, parameters.variables);
    if (bodyParams.length > 0) {
      whatsappComponents.push({
        type: 'BODY',
        parameters: bodyParams
      });
    }
  }

  // 3. Process BUTTONS component
  const buttonsComponent = templateComponents.find((c: any) => c.type === 'BUTTONS');
  if (buttonsComponent?.buttons) {
    console.log(`📋 Processing ${buttonsComponent.buttons.length} buttons`);
    
    const buttonComponents = this.buildButtonComponents(buttonsComponent.buttons);
    whatsappComponents.push(...buttonComponents);
  }

  // 4. 🚨 INTENTIONALLY SKIP FOOTER COMPONENT - NOT SENT TO WHATSAPP
  const footerComponent = templateComponents.find((c: any) => c.type === 'FOOTER');
  if (footerComponent?.text) {
    console.log(`📌 FOOTER found in database: "${footerComponent.text.substring(0, 60)}"`);
    console.log(`📌 NOT sending footer to WhatsApp API - WhatsApp will use static footer from template`);
    // Footer is NOT added to whatsappComponents array
  }

  console.log(`✅ Converted ${whatsappComponents.length} WhatsApp API components (excluding FOOTER)`);
  return whatsappComponents;
} 

  /**
   * Builds header parameters from media
   */
  private buildHeaderParameters(headerComponent: any, media: any): MessageParameter[] {
    if (!media?.url) {
      console.warn('⚠️ No media URL provided for header');
      return [];
    }

    const headerFormat = headerComponent.format?.toLowerCase();
    if (!headerFormat || !['image', 'video', 'document'].includes(headerFormat)) {
      console.error(`❌ Invalid header format: ${headerFormat}`);
      return [];
    }

    console.log(`📁 Building ${headerFormat} header with URL: ${media.url.substring(0, 100)}...`);

    switch (headerFormat) {
      case 'image':
        return [{
          type: 'image',
          image: {
            link: media.url
          }
        }];
        
      case 'video':
        return [{
          type: 'video',
          video: {
            link: media.url
          }
        }];
        
      case 'document':
        return [{
          type: 'document',
          document: {
            link: media.url,
            ...(media.filename ? { filename: media.filename } : {})
          }
        }];
        
      default:
        return [];
    }
  }

  /**
   * Builds body parameters from template variables
   */
  private buildBodyParameters(bodyComponent: any, variables: Record<string, any>): TextParameter[] {
    const parameters: TextParameter[] = [];

    console.log('🔍 Building body parameters:', {
      hasExample: !!bodyComponent.example,
      variableCount: Object.keys(variables).length,
      variableNames: Object.keys(variables)
    });

    // Check for NAMED parameters (body_text_named_params)
    if (bodyComponent.example?.body_text_named_params) {
      const namedParams = bodyComponent.example.body_text_named_params;
      
      console.log(`📋 Found ${namedParams.length} named parameters`);
      
      // Sort to ensure correct order
      namedParams.sort((a: any, b: any) => a.param_name.localeCompare(b.param_name));
      
      for (const param of namedParams) {
        const paramName = param.param_name;
        const value = variables[paramName] || param.example || '';
        
        console.log(`  📝 "${paramName}": "${value}"`);
        
        parameters.push({
          type: 'text',
          text: String(value).substring(0, 32768)
        });
      }
    }
    // Check for POSITIONAL parameters (body_text)
    else if (bodyComponent.example?.body_text) {
      const positionGroups = bodyComponent.example.body_text;
      if (positionGroups && positionGroups.length > 0) {
        const exampleGroup = positionGroups[0];
        
        console.log(`📋 Found ${exampleGroup.length} positional parameters`);
        
        for (let i = 0; i < exampleGroup.length; i++) {
          const value = variables[i.toString()] || exampleGroup[i] || '';
          
          console.log(`  📝 Position ${i}: "${value}"`);
          
          parameters.push({
            type: 'text',
            text: String(value).substring(0, 32768)
          });
        }
      }
    }
    // Fallback: Try to extract from text pattern
    else if (bodyComponent.text) {
      const matches = bodyComponent.text.match(/\{\{(\w+)\}\}/g) || [];
      const variableNames = matches.map((match: string) => 
        match.replace(/\{\{|\}\}/g, '')
      );
      
      console.log(`📋 Found ${variableNames.length} variables in text`);
      
      for (const varName of variableNames) {
        const value = variables[varName] || '';
        console.log(`  📝 "${varName}": "${value}"`);
        
        parameters.push({
          type: 'text',
          text: String(value).substring(0, 32768)
        });
      }
    } else {
      console.warn('⚠️ No parameter information found in body component');
    }

    console.log(`✅ Built ${parameters.length} body parameters`);
    return parameters;
  }

  /**
   * Builds button components
   */
  private buildButtonComponents(buttons: any[]): MessageComponent[] {
    const buttonComponents: MessageComponent[] = [];

    console.log(`🔘 Processing ${buttons.length} buttons`);

    buttons.forEach((button, index) => {
      console.log(`  🔘 Button ${index}: ${button.type} - "${button.text}"`);

      // Handle different button types
      if (button.type === 'URL' && button.url) {
        // URL button with dynamic parameter
        buttonComponents.push({
          type: 'BUTTONS',
          sub_type: 'url',
          index: index,
          parameters: [{
            type: 'text',
            text: button.url
          }]
        });
      } else if (button.type === 'QUICK_REPLY') {
        // Quick reply button
        buttonComponents.push({
          type: 'BUTTONS',
          sub_type: 'quick_reply',
          index: index,
          parameters: [{
            type: 'text',
            text: button.text || `button_${index}`
          }]
        });
      }
      // PHONE_NUMBER buttons don't have dynamic parameters
    });

    return buttonComponents;
  }

  /**
   * Sends a template message
   */
  public async sendTemplateMessage(
    phoneNumberId: string,
    accessToken: string,
    message: SendTemplateMessageRequest
  ): Promise<WhatsAppMessageResponse> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;

      console.log('📤 SENDING WHATSAPP TEMPLATE MESSAGE:');
      console.log('URL:', url);
      console.log('TEMPLATE:', message.template.name);
      console.log('LANGUAGE:', message.template.language.code);
      console.log('TO:', message.to.substring(0, 8) + '...');
      console.log('COMPONENTS:', message.template.components?.length || 0);

      // Log the FULL payload for debugging
      console.log('📦 FULL PAYLOAD:');
      console.log(JSON.stringify(message, null, 2));

      const response = await axios.post(url, message, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 30000
      });

      console.log('✅ WhatsApp API Response:', response.data);
      return response.data;

    } catch (error: any) {
      console.error('❌ WHATSAPP API ERROR:');
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      
      if (error.response?.data?.error) {
        const whatsappError = error.response.data.error;
        throw new WhatsAppTemplateError(
          whatsappError.message,
          error.response.status,
          whatsappError.code,
          whatsappError.type,
          whatsappError.fbtrace_id
        );
      }

      throw new Error(error.message || 'Failed to send template message');
    }
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class WhatsAppTemplateError extends Error {
  public readonly statusCode?: number | undefined;
  public readonly errorCode?: number | undefined;
  public readonly errorType?: string | undefined;
  public readonly fbTraceId?: string | undefined;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: number,
    errorType?: string,
    fbTraceId?: string
  ) {
    super(message);
    this.name = 'WhatsAppTemplateError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errorType = errorType;
    this.fbTraceId = fbTraceId;
  }
}
// Export instance for easy use
export const whatsappTemplateService = new WhatsAppTemplateAPIClient();