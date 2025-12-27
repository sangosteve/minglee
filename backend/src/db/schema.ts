//backend/src/db/schema.ts
import { 
  pgTable, 
  uuid,
  varchar, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  jsonb,
  doublePrecision,
  pgEnum,
  index,
  unique
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Helper for UUID generation
const generateUuid = () => sql`gen_random_uuid()`;

// Status enum for contacts
export const contactStatusEnum = pgEnum("contact_status", [
  "active",
  "inactive", 
  "archived",
  "blocked",
  "lead",
  "customer"
]);

// Source enum for contacts
export const contactSourceEnum = pgEnum("contact_source", [
  "manual",
  "whatsapp",
  "import",
  "website",
  "api"
]);

// Users table with UUID primary key
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(generateUuid()),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  avatarUrl: text("avatar_url"),
  googleId: varchar("google_id", { length: 255 }),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  whatsappBusinessId: varchar("whatsapp_business_id", { length: 255 }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  whatsappAccessToken: text("whatsapp_access_token"),
  isActive: boolean("is_active").default(true),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tags table
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tags_user_id").on(table.userId),
]);

// Contacts table with UUID primary key
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }).default(""),
  
  // Location fields
  address: text("address").default(""),
  city: varchar("city", { length: 100 }).default(""),
  state: varchar("state", { length: 100 }).default(""),
  country: varchar("country", { length: 100 }).default(""),
  postalCode: varchar("postal_code", { length: 20 }).default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  
  note: text("note").default(""),
  
  // Relationships
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  
  whatsappBusinessId: varchar("whatsapp_business_id", { length: 255 }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  tagIds: uuid("tag_ids").array().default([]),
  
  // Status and source using enums
  status: contactStatusEnum("status").default("active"),
  source: contactSourceEnum("source").default("manual"),
  
  isActive: boolean("is_active").default(true),
  optIn: boolean("opt_in").default(true),
  lastContactedAt: timestamp("last_contacted_at"),
  customFields: jsonb("custom_fields").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contacts_tag_ids").on(table.tagIds),
]);

// Conversations table
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  
  // Conversation data
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  tagIds: uuid("tag_ids").array().default([]),
  
  // Status
  status: varchar("status", { length: 50 }).default("active"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_conversations_tag_ids").on(table.tagIds),
]);

// Media attachments table (must be defined before messages)
export const mediaAttachments = pgTable("media_attachments", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships
  messageId: uuid("message_id").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Cloudinary-specific fields
  publicId: varchar("public_id", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 20 }).default('image'),
  format: varchar("format", { length: 10 }),
  version: varchar("version", { length: 20 }),
  
  // File metadata
  originalFilename: varchar("original_filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"),
  
  // Cloudinary URLs
  secureUrl: text("secure_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  
  // Additional metadata
  caption: text("caption"),
  tags: text("tags").array().default([]),
  
  // Status and timestamps
  status: varchar("status", { length: 20 }).default('active'),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  mediaAttachmentId: uuid('media_attachment_id').references(() => mediaAttachments.id),
  
  // Message data
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  direction: varchar("direction", { length: 10 }).default("outgoing"),
  messageType: varchar("message_type", { length: 50 }).default("text"),
  body: text("body"),
  status: varchar("status", { length: 50 }).default("sent"),
  metadata: jsonb("metadata").default({}),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Now update mediaAttachments to reference messages properly
// (This is a workaround for circular dependency)
import { relations } from 'drizzle-orm';

// You can define relations separately if needed
export const mediaAttachmentsRelations = relations(mediaAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [mediaAttachments.messageId],
    references: [messages.id],
  }),
}));

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 255 }),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quick Replies table
export const quickReplies = pgTable("quick_replies", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 255 }).notNull(),
  message: text("message").notNull(),
  topics: varchar("topics", { length: 255 }).default("General"),
  
  // Relationships
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Media attachments (references to media_attachments table)
  mediaAttachmentIds: uuid("media_attachment_ids").array().default([]),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quick_replies_user_id").on(table.userId),
  index("idx_quick_replies_is_active").on(table.isActive),
  index("idx_quick_replies_media_attachment_ids").on(table.mediaAttachmentIds),
]);

// Refresh tokens table
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().default(generateUuid()),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  isRevoked: boolean("is_revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// API keys table
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().default(generateUuid()),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  key: varchar("key", { length: 64 }).unique().notNull(),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Automation Status Enum
export const automationStatusEnum = pgEnum("automation_status", [
  "draft",
  "active",
  "paused",
  "archived"
]);

// Trigger Type Enum
export const automationTriggerEnum = pgEnum("automation_trigger", [
  "manual",
  "message_received",
  "keyword",
  "tag_added",
  "campaign_reply",
  "time_delay",
  "contact_created",
  "contact_updated",
  "webhook"
]);

// Automations table
export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Relationships
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Trigger configuration
  triggerType: automationTriggerEnum("trigger_type").default("manual"),
  triggerConfig: jsonb("trigger_config").default({}),
  
  // Flow data (React Flow nodes and edges)
  flowData: jsonb("flow_data").default({ nodes: [], edges: [] }),
  
  // Status and stats
  status: automationStatusEnum("status").default("draft"),
  totalRuns: integer("total_runs").default(0),
  successfulRuns: integer("successful_runs").default(0),
  failedRuns: integer("failed_runs").default(0),
  
  // Timestamps
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_automations_user_id").on(table.userId),
  index("idx_automations_status").on(table.status),
  index("idx_automations_trigger_type").on(table.triggerType),
]);

// Automation runs (execution history)
export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships
  automationId: uuid("automation_id").references(() => automations.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade"}),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null"}),
  
  // Execution data
  triggerData: jsonb("trigger_data").default({}),
  executionData: jsonb("execution_data").default({}),
  nodeExecutions: jsonb("node_executions").default([]),
  error: text("error"),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  
  // Timestamps
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_automation_runs_automation_id").on(table.automationId),
  index("idx_automation_runs_contact_id").on(table.contactId),
  index("idx_automation_runs_status").on(table.status),
  index("idx_automation_runs_created_at").on(table.createdAt),
]);