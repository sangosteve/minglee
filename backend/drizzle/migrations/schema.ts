// backend/src/db/schema.ts
import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  unique, 
  boolean, 
  foreignKey, 
  integer, 
  index, 
  jsonb, 
  doublePrecision, 
  pgEnum 
} from "drizzle-orm/pg-core";

// Enums
export const contactSource = pgEnum("contact_source", ['manual', 'whatsapp', 'import', 'website', 'api']);
export const contactStatus = pgEnum("contact_status", ['active', 'inactive', 'archived', 'blocked', 'lead', 'customer']);
export const messageDirection = pgEnum("message_direction", ['incoming', 'outgoing']);
export const messageStatus = pgEnum("message_status", ['sent', 'delivered', 'read', 'failed', 'pending']);
export const messageType = pgEnum("message_type", ['text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'contacts', 'interactive']);
export const conversationStatus = pgEnum("conversation_status", ['active', 'closed', 'archived', 'spam']);
export const mediaResourceType = pgEnum("media_resource_type", ['image', 'video', 'audio', 'document']);

// Users table
export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  email: varchar({ length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  name: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 50 }), // Increased from 20 to 50
  avatarUrl: text("avatar_url"),
  googleId: varchar("google_id", { length: 255 }),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  whatsappBusinessId: varchar("whatsapp_business_id", { length: 255 }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  whatsappAccessToken: text("whatsapp_access_token"),
  isActive: boolean("is_active").default(true),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  unique("users_email_unique").on(table.email),
]);

// Tags table
export const tags = pgTable("tags", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  color: varchar({ length: 7 }).default('#3B82F6'),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_tags_user_id").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "tags_user_id_users_id_fk"
  }).onDelete("cascade"),
]);

// Contacts table (with increased phone length)
export const contacts = pgTable("contacts", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }),
  phone: varchar({ length: 50 }), // CRITICAL: Increased from 20 to 50
  email: varchar({ length: 255 }).default(''),
  note: text().default(''),
  userId: uuid("user_id"),
  whatsappBusinessId: varchar("whatsapp_business_id", { length: 255 }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
  address: text().default(''),
  city: varchar({ length: 100 }).default(''),
  state: varchar({ length: 100 }).default(''),
  country: varchar({ length: 100 }).default(''),
  postalCode: varchar("postal_code", { length: 20 }).default(''),
  latitude: doublePrecision(),
  longitude: doublePrecision(),
  status: contactStatus().default('active'),
  source: contactSource().default('manual'),
  optIn: boolean("opt_in").default(true),
  lastContactedAt: timestamp("last_contacted_at", { mode: 'string' }),
  customFields: jsonb("custom_fields").default({}),
  tagIds: uuid("tag_ids").array().default([]), // Changed from default([""]) to default([])
}, (table) => [
  index("idx_contacts_user_id").on(table.userId),
  index("idx_contacts_phone").on(table.phone),
  index("idx_contacts_email").on(table.email),
  index("idx_contacts_tag_ids").using("gin", table.tagIds),
  index("idx_contacts_status").on(table.status),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "contacts_user_id_users_id_fk"
  }).onDelete("set null"),
]);

// Conversations table
export const conversations = pgTable("conversations", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  contactId: uuid("contact_id"),
  userId: uuid("user_id"),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { mode: 'string' }).defaultNow(),
  unreadCount: integer("unread_count").default(0),
  status: varchar({ length: 50 }).default('active'),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
  assignedToUserId: uuid("assigned_to_user_id"),
  tagIds: uuid("tag_ids").array().default([]), // Changed from default([""]) to default([])
}, (table) => [
  index("idx_conversations_contact_id").on(table.contactId),
  index("idx_conversations_user_id").on(table.userId),
  index("idx_conversations_status").on(table.status),
  index("idx_conversations_tag_ids").using("gin", table.tagIds),
  foreignKey({
    columns: [table.contactId],
    foreignColumns: [contacts.id],
    name: "conversations_contact_id_contacts_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "conversations_user_id_users_id_fk"
  }).onDelete("set null"),
  foreignKey({
    columns: [table.assignedToUserId],
    foreignColumns: [users.id],
    name: "conversations_assigned_to_user_id_users_id_fk"
  }).onDelete("set null"),
]);

// Messages table
export const messages = pgTable("messages", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  contactId: uuid("contact_id"),
  conversationId: uuid("conversation_id"),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  direction: messageDirection().default('outgoing'),
  messageType: messageType().default('text'),
  content: text(), // Changed from 'body' to 'content' for consistency
  status: messageStatus().default('sent'),
  metadata: jsonb().default({}),
  timestamp: timestamp({ mode: 'string' }).defaultNow(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
  mediaAttachmentId: uuid("media_attachment_id"),
  senderId: uuid("sender_id"),
  errorMessage: text("error_message"),
}, (table) => [
  index("idx_messages_conversation_id").on(table.conversationId),
  index("idx_messages_contact_id").on(table.contactId),
  index("idx_messages_created_at").on(table.createdAt),
  foreignKey({
    columns: [table.contactId],
    foreignColumns: [contacts.id],
    name: "messages_contact_id_contacts_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.conversationId],
    foreignColumns: [conversations.id],
    name: "messages_conversation_id_conversations_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.senderId],
    foreignColumns: [users.id],
    name: "messages_sender_id_users_id_fk"
  }).onDelete("set null"),
]);

// Media Attachments table
export const mediaAttachments = pgTable("media_attachments", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  messageId: uuid("message_id"),
  uploadedByUserId: uuid("uploaded_by_user_id"),
  publicId: varchar("public_id", { length: 255 }).notNull(),
  resourceType: mediaResourceType().default('image'),
  format: varchar({ length: 10 }),
  version: varchar({ length: 20 }),
  originalFilename: varchar("original_filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  width: integer(),
  height: integer(),
  duration: integer(),
  secureUrl: text("secure_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text(),
  tags: text().array().default([]), // Changed from default([""]) to default([])
  status: varchar({ length: 20 }).default('active'),
  uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_media_attachments_message_id").on(table.messageId),
  index("idx_media_attachments_user_id").on(table.uploadedByUserId),
  foreignKey({
    columns: [table.messageId],
    foreignColumns: [messages.id],
    name: "media_attachments_message_id_messages_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.uploadedByUserId],
    foreignColumns: [users.id],
    name: "media_attachments_uploaded_by_user_id_users_id_fk"
  }).onDelete("set null"),
]);

// API Keys table
export const apiKeys = pgTable("api_keys", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id"),
  name: varchar({ length: 100 }).notNull(),
  key: varchar({ length: 64 }).notNull(),
  lastUsed: timestamp("last_used", { mode: 'string' }),
  expiresAt: timestamp("expires_at", { mode: 'string' }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "api_keys_user_id_users_id_fk"
  }).onDelete("cascade"),
  unique("api_keys_key_unique").on(table.key),
]);

// Refresh Tokens table
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id"),
  token: varchar({ length: 500 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  isRevoked: boolean("is_revoked").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "refresh_tokens_user_id_users_id_fk"
  }).onDelete("cascade"),
  unique("refresh_tokens_token_unique").on(table.token),
]);

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }),
  description: text().default(''),
  createdByUserId: uuid("created_by_user_id"),
  status: varchar({ length: 50 }).default('draft'),
  scheduledAt: timestamp("scheduled_at", { mode: 'string' }),
  sentAt: timestamp("sent_at", { mode: 'string' }),
  messageTemplate: text("message_template"),
  totalRecipients: integer("total_recipients").default(0),
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalRead: integer("total_read").default(0),
  totalFailed: integer("total_failed").default(0),
  tagIds: uuid("tag_ids").array().default([]),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_campaigns_created_by_user_id").on(table.createdByUserId),
  index("idx_campaigns_status").on(table.status),
  index("idx_campaigns_tag_ids").using("gin", table.tagIds),
  foreignKey({
    columns: [table.createdByUserId],
    foreignColumns: [users.id],
    name: "campaigns_created_by_user_id_users_id_fk"
  }).onDelete("set null"),
]);

// Campaign Messages table
export const campaignMessages = pgTable("campaign_messages", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  campaignId: uuid("campaign_id"),
  contactId: uuid("contact_id"),
  messageId: uuid("message_id"),
  status: varchar({ length: 50 }).default('pending'),
  scheduledAt: timestamp("scheduled_at", { mode: 'string' }),
  sentAt: timestamp("sent_at", { mode: 'string' }),
  deliveredAt: timestamp("delivered_at", { mode: 'string' }),
  readAt: timestamp("read_at", { mode: 'string' }),
  failedAt: timestamp("failed_at", { mode: 'string' }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_campaign_messages_campaign_id").on(table.campaignId),
  index("idx_campaign_messages_contact_id").on(table.contactId),
  index("idx_campaign_messages_status").on(table.status),
  foreignKey({
    columns: [table.campaignId],
    foreignColumns: [campaigns.id],
    name: "campaign_messages_campaign_id_campaigns_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.contactId],
    foreignColumns: [contacts.id],
    name: "campaign_messages_contact_id_contacts_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.messageId],
    foreignColumns: [messages.id],
    name: "campaign_messages_message_id_messages_id_fk"
  }).onDelete("set null"),
]);

// Quick Replies table
export const quickReplies = pgTable("quick_replies", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  message: text().notNull(),
  topics: varchar({ length: 255 }).default('General'),
  userId: uuid("user_id").notNull(),
  mediaAttachmentIds: uuid("media_attachment_ids").array().default([]), // Changed from default([""]) to default([])
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_quick_replies_user_id").on(table.userId),
  index("idx_quick_replies_is_active").on(table.isActive),
  index("idx_quick_replies_media_attachment_ids").using("gin", table.mediaAttachmentIds),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "quick_replies_user_id_fkey"
  }).onDelete("cascade"),
]);

// Templates table
export const templates = pgTable("templates", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 100 }).default('general'),
  language: varchar({ length: 10 }).default('en'),
  components: jsonb().notNull(),
  status: varchar({ length: 50 }).default('draft'),
  whatsappTemplateId: varchar("whatsapp_template_id", { length: 255 }),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_templates_user_id").on(table.userId),
  index("idx_templates_status").on(table.status),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "templates_user_id_users_id_fk"
  }).onDelete("set null"),
]);

// Analytics table
export const analytics = pgTable("analytics", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id"),
  date: timestamp({ mode: 'string' }).notNull(),
  totalContacts: integer("total_contacts").default(0),
  activeContacts: integer("active_contacts").default(0),
  newContacts: integer("new_contacts").default(0),
  totalMessages: integer("total_messages").default(0),
  incomingMessages: integer("incoming_messages").default(0),
  outgoingMessages: integer("outgoing_messages").default(0),
  deliveredMessages: integer("delivered_messages").default(0),
  readMessages: integer("read_messages").default(0),
  failedMessages: integer("failed_messages").default(0),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_analytics_user_id").on(table.userId),
  index("idx_analytics_date").on(table.date),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "analytics_user_id_users_id_fk"
  }).onDelete("cascade"),
]);

// Webhook Events table
export const webhookEvents = pgTable("webhook_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb().notNull(),
  source: varchar({ length: 100 }).default('whatsapp'),
  processed: boolean().default(false),
  processedAt: timestamp("processed_at", { mode: 'string' }),
  error: text(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_webhook_events_event_type").on(table.eventType),
  index("idx_webhook_events_processed").on(table.processed),
  index("idx_webhook_events_created_at").on(table.createdAt),
]);

// Contact Groups table (optional)
export const contactGroups = pgTable("contact_groups", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  userId: uuid("user_id").notNull(),
  tagIds: uuid("tag_ids").array().default([]),
  contactCount: integer("contact_count").default(0),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_contact_groups_user_id").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "contact_groups_user_id_users_id_fk"
  }).onDelete("cascade"),
]);

// Contact Group Members table (optional)
export const contactGroupMembers = pgTable("contact_group_members", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  groupId: uuid("group_id").notNull(),
  contactId: uuid("contact_id").notNull(),
  addedAt: timestamp("added_at", { mode: 'string' }).defaultNow(),
}, (table) => [
  index("idx_contact_group_members_group_id").on(table.groupId),
  index("idx_contact_group_members_contact_id").on(table.contactId),
  unique("contact_group_members_unique").on(table.groupId, table.contactId),
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [contactGroups.id],
    name: "contact_group_members_group_id_contact_groups_id_fk"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.contactId],
    foreignColumns: [contacts.id],
    name: "contact_group_members_contact_id_contacts_id_fk"
  }).onDelete("cascade"),
]);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;