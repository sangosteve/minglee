// src/db/schema.ts
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
  pgEnum
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


export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"), // Hex color code
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  
  // Relationships - using UUIDs
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
});

// Conversations table with UUID primary key
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships - using UUIDs
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  whatsappPhoneNumberId: varchar("whatsapp_phone_number_id", { length: 255 }),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  
  // Status enum for conversations
  status: varchar("status", { length: 50 }).default("active"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages table with UUID primary key
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships - using UUIDs
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
   mediaAttachmentId: uuid('media_attachment_id').references(() => mediaAttachments.id),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  direction: varchar("direction", { length: 10 }).default("outgoing"),
  messageType: varchar("message_type", { length: 50 }).default("text"),
  body: text("body"),
  status: varchar("status", { length: 50 }).default("sent"),
  metadata: jsonb("metadata").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaAttachments = pgTable("media_attachments", {
  id: uuid("id").primaryKey().default(generateUuid()),
  
  // Relationships
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Cloudinary-specific fields
  publicId: varchar("public_id", { length: 255 }).notNull(), // Cloudinary public ID
  resourceType: varchar("resource_type", { length: 20 }).default('image'), // image, video, raw
  format: varchar("format", { length: 10 }), // jpg, png, mp4, pdf, etc.
  version: varchar("version", { length: 20 }),
  
  // File metadata
  originalFilename: varchar("original_filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"), // Size in bytes
  width: integer("width"), // For images/videos
  height: integer("height"), // For images/videos
  duration: integer("duration"), // For audio/video in seconds
  
  // Cloudinary URLs
  secureUrl: text("secure_url").notNull(), // HTTPS URL for delivery
  thumbnailUrl: text("thumbnail_url"), // Generated thumbnail URL
  
  // Additional metadata
  caption: text("caption"),
  tags: text("tags").array().default([]),
  
  // Status and timestamps
  status: varchar("status", { length: 20 }).default('active'), // active, deleted
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns table with UUID primary key
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(generateUuid()),
  name: varchar("name", { length: 255 }),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});




// Refresh tokens table with UUID primary key
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

// API keys table with UUID primary key
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