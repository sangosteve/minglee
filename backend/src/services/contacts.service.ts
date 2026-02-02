// backend/src/services/contacts.service.ts
import { getDb } from '../db/client';
import { contacts, conversations, messages, users } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { WhatsAppMessage } from './whatsapp.service';

export interface ContactData {
  phoneNumber: string;
  name?: string;
  email?: string;
  tags?: string[];
  userId: string;
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
    userId?: string,
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
        
        userId = anyUser[0]?.id || '';
      } else {
        userId = defaultUser[0]?.id || '';
      }
    }
    
    // Try to find existing contact for this user
    let contactResult = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.phone, formattedPhone),
          eq(contacts.userId, userId)
        )
      )
      .limit(1);
    
    let contact;
    
if (contactResult.length === 0 || !contactResult[0]) {
  // Create new contact
  const [newContact] = await db.insert(contacts).values({
    phone: formattedPhone, // This field exists according to the error
    name: name || `Contact ${formattedPhone}`,
    email: '',
    note: '',
    userId: userId,
    whatsappBusinessId: whatsappBusinessId || null,
    whatsappPhoneNumberId: whatsappPhoneNumberId || null,
    tagIds: [], // Changed from 'tags' to 'tagIds'
    status: 'active',
    source: 'whatsapp',
    isActive: true,
    optIn: true,
    // Add missing required fields that might have defaults
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning();
  
  contact = newContact;
} else {
      contact = contactResult[0];
      
      // Update name if provided and different
      if (name && name !== contact?.name) {
        await db.update(contacts)
          .set({ 
            name, 
            updatedAt: new Date().toISOString(),
            source: 'whatsapp'
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
    contactId: string,
    whatsappPhoneNumberId: string,
    userId?: string
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
    
    if (conversationResult.length === 0 || !conversationResult[0]) {
      // Create new conversation
      const [newConversation] = await db.insert(conversations).values({
        contactId,
        whatsappPhoneNumberId,
        status: 'active',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        userId: userId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    contactId: string,
    conversationId: string,
    direction: 'incoming' | 'outgoing' = 'incoming'
  ) {
    const db = getDb();
    
    const [savedMessage] = await db.insert(messages).values({
      conversationId,
      contactId,
      whatsappMessageId: message.id,
      body: message.text?.body || '',
      messageType: message.type,
      direction,
      status: direction === 'incoming' ? 'received' : 'sent',
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      metadata: {
        type: message.type,
        ...(message.text && { text: message.text }),
        ...(message.image && { image: message.image }),
        ...(message.location && { location: message.location }),
      },

    }).returning();
    
    // Update conversation's last message timestamp
    if (direction === 'incoming') {
      await db.update(conversations)
        .set({ 
          lastMessageAt: new Date().toISOString(),
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, conversationId));
    } else {
      await db.update(conversations)
        .set({ 
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, conversationId));
    }
    
    return savedMessage;
  }

  /**
   * Get all contacts for a user
   */
  static async getUserContacts(userId: string, page: number = 1, limit: number = 20) {
    const db = getDb();
    const offset = (page - 1) * limit;
    
    const contactsList = await db.select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(contacts.createdAt);
    
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    const total = totalResult.length > 0 ? Number(totalResult[0]?.count || 0) : 0;
    
    return {
      contacts: contactsList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}