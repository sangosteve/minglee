// backend/src/services/contacts.service.ts
import { getDb } from '../db/client';
import { contacts, conversations, messages, users } from '../db/schema'; // ADD users import
import { eq, and } from 'drizzle-orm';
import { WhatsAppMessage } from './whatsapp.service';

export interface ContactData {
  phoneNumber: string;
  name?: string;
  email?: string;
  tags?: string[];
  userId: string; // Changed to string for UUID
  whatsappBusinessId?: string;
  whatsappPhoneNumberId?: string;
}

export class ContactsService {
  /**
   * Find or create contact from WhatsApp message
   */
  static async findOrCreateFromWhatsApp(
    phoneNumber: string,
    name?: string,
    userId?: string, // Changed to string for UUID
    whatsappBusinessId?: string,
    whatsappPhoneNumberId?: string
  ) {
    const db = getDb();
    
    // Format phone number (remove non-numeric characters)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    if (!userId) {
      // If no user specified, find first admin user
      const defaultUser = await db.select()
        .from(users)
        .where(eq(users.isAdmin, true))
        .orderBy(users.createdAt)
        .limit(1);
      
      if (defaultUser.length === 0) {
        // Get any user
        const anyUser = await db.select()
          .from(users)
          .orderBy(users.createdAt)
          .limit(1);
        
        if (anyUser.length === 0) {
          throw new Error('No users found in database');
        }
        
        userId = anyUser[0].id;
      } else {
        userId = defaultUser[0].id;
      }
    }
    
    // Try to find existing contact for this user
    let contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, formattedPhone), // Changed from phoneNumber to phone
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    let contact;
    
    if (contactResult.length === 0) {
      // Create new contact
      const [newContact] = await db.insert(contacts).values({
        phone: formattedPhone, // Changed from phoneNumber to phone
        name: name || `Contact ${formattedPhone}`,
        email: '',
        note: '',
        userId: userId,
        whatsappBusinessId: whatsappBusinessId || null,
        whatsappPhoneNumberId: whatsappPhoneNumberId || null,
        tags: [],
        status: 'active',
        source: 'whatsapp',
        isActive: true,
        optIn: true,
      }).returning();
      
      contact = newContact;
    } else {
      contact = contactResult[0];
      
      // Update name if provided and different
      if (name && name !== contact.name) {
        await db.update(contacts)
          .set({ 
            name, 
            updatedAt: new Date(),
            source: 'whatsapp' // Update source
          })
          .where(eq(contacts.id, contact.id));
        contact.name = name;
      }
    }
    
    return contact;
  }

  /**
   * Create or update conversation for a contact
   */
  static async findOrCreateConversation(
    contactId: string, // Changed to string for UUID
    whatsappPhoneNumberId: string,
    userId?: string // Changed to string for UUID
  ) {
    const db = getDb();
    
    // Try to find existing conversation
    let conversationResult = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.contactId, contactId),
          eq(conversations.whatsappPhoneNumberId, whatsappPhoneNumberId)
        )
      )
      .limit(1);
    
    let conversation;
    
    if (conversationResult.length === 0) {
      // Create new conversation
      const [newConversation] = await db.insert(conversations).values({
        contactId,
        whatsappPhoneNumberId,
        status: 'active',
        lastMessageAt: new Date(),
        unreadCount: 0,
        userId: userId || null,
      }).returning();
      
      conversation = newConversation;
    } else {
      conversation = conversationResult[0];
    }
    
    return conversation;
  }

  /**
   * Save incoming message
   */
  static async saveIncomingMessage(
    message: WhatsAppMessage,
    contactId: string, // Changed to string for UUID
    conversationId: string, // Changed to string for UUID
    direction: 'incoming' | 'outgoing' = 'incoming'
  ) {
    const db = getDb();
    
    const [savedMessage] = await db.insert(messages).values({
      conversationId,
      contactId,
      whatsappMessageId: message.id,
      content: message.text?.body || '',
      messageType: message.type,
      direction,
      status: direction === 'incoming' ? 'received' : 'sent',
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      metadata: {
        type: message.type,
        ...(message.text && { text: message.text }),
        ...(message.image && { image: message.image }),
        ...(message.location && { location: message.location }),
      },
    }).returning();
    
    // Update conversation's last message timestamp
    await db.update(conversations)
      .set({ 
        lastMessageAt: new Date(),
        unreadCount: direction === 'incoming' ? 
          conversations.unreadCount + 1 : conversations.unreadCount 
      })
      .where(eq(conversations.id, conversationId));
    
    return savedMessage;
  }

  /**
   * Get all contacts for a user
   */
  static async getUserContacts(userId: string, page: number = 1, limit: number = 20) { // Changed to string
    const db = getDb();
    const offset = (page - 1) * limit;
    
    const contactsList = await db.select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(contacts.createdAt);
    
    const total = await db.select({ count: contacts.id })
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    return {
      contacts: contactsList,
      pagination: {
        page,
        limit,
        total: total.length > 0 ? Number(total[0].count) : 0,
        pages: Math.ceil((total.length > 0 ? Number(total[0].count) : 0) / limit),
      },
    };
  }
}