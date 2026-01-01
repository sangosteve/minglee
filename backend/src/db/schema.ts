import { pgTable, uuid, varchar, text, timestamp, unique, boolean, foreignKey, integer, jsonb, index, doublePrecision, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const automationStatus = pgEnum("automation_status", ['draft', 'active', 'paused', 'archived'])
export const automationTrigger = pgEnum("automation_trigger", ['manual', 'message_received', 'keyword', 'tag_added', 'campaign_reply', 'time_delay', 'contact_created', 'contact_updated', 'webhook'])
export const contactSource = pgEnum("contact_source", ['manual', 'whatsapp', 'import', 'website', 'api'])
export const contactStatus = pgEnum("contact_status", ['active', 'inactive', 'archived', 'blocked', 'lead', 'customer'])
export const teamRole = pgEnum("team_role", ['owner', 'admin', 'manager', 'member', 'viewer'])
export const teamStatus = pgEnum("team_status", ['active', 'pending', 'inactive', 'suspended'])


export const campaigns = pgTable("campaigns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }),
	description: text().default(''),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }),
	name: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 20 }),
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

export const mediaAttachments = pgTable("media_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id"),
	uploadedByUserId: uuid("uploaded_by_user_id"),
	publicId: varchar("public_id", { length: 255 }).notNull(),
	resourceType: varchar("resource_type", { length: 20 }).default('image'),
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
	tags: text().array().default([]),
	status: varchar({ length: 20 }).default('active'),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.uploadedByUserId],
			foreignColumns: [users.id],
			name: "media_attachments_uploaded_by_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
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
	tagIds: uuid("tag_ids").array().default([]),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "contacts_user_id_users_id_fk"
		}).onDelete("set null"),
]);

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
	tagIds: uuid("tag_ids").array().default([]),
}, (table) => [
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

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contactId: uuid("contact_id"),
	whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
	conversationId: uuid("conversation_id"),
	direction: varchar({ length: 10 }).default('outgoing'),
	messageType: varchar("message_type", { length: 50 }).default('text'),
	body: text(),
	status: varchar({ length: 50 }).default('sent'),
	metadata: jsonb().default({}),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	mediaAttachmentId: uuid("media_attachment_id"),
}, (table) => [
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
			columns: [table.mediaAttachmentId],
			foreignColumns: [mediaAttachments.id],
			name: "messages_media_attachment_id_media_attachments_id_fk"
		}),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	color: varchar({ length: 7 }).default('#3B82F6'),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_tags_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "tags_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const quickReplies = pgTable("quick_replies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	topics: varchar({ length: 255 }).default('General'),
	userId: uuid("user_id").notNull(),
	mediaAttachmentIds: uuid("media_attachment_ids").array().default([]),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_quick_replies_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_quick_replies_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const automationRuns = pgTable("automation_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	automationId: uuid("automation_id").notNull(),
	contactId: uuid("contact_id"),
	userId: uuid("user_id"),
	triggerData: jsonb("trigger_data").default({}),
	executionData: jsonb("execution_data").default({}),
	nodeExecutions: jsonb("node_executions").default([]),
	error: text(),
	status: varchar({ length: 50 }).default('pending'),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const automations = pgTable("automations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	userId: uuid("user_id").notNull(),
	triggerType: automationTrigger("trigger_type").default('manual'),
	triggerConfig: jsonb("trigger_config").default({}),
	flowData: jsonb("flow_data").default({"edges":[],"nodes":[]}),
	status: automationStatus().default('draft'),
	totalRuns: integer("total_runs").default(0),
	successfulRuns: integer("successful_runs").default(0),
	failedRuns: integer("failed_runs").default(0),
	lastRunAt: timestamp("last_run_at", { mode: 'string' }),
	nextRunAt: timestamp("next_run_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const teamInvitations = pgTable("team_invitations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	invitedByUserId: uuid("invited_by_user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	role: teamRole().default('member'),
	token: varchar({ length: 100 }).notNull(),
	status: varchar({ length: 20 }).default('pending'),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("team_invitations_token_unique").on(table.token),
]);

export const teamMembers = pgTable("team_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: teamRole().default('member'),
	status: teamStatus().default('active'),
	permissions: jsonb().default({}),
	invitedByUserId: uuid("invited_by_user_id"),
	invitedAt: timestamp("invited_at", { mode: 'string' }),
	invitedEmail: varchar("invited_email", { length: 255 }),
	invitationToken: varchar("invitation_token", { length: 100 }),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	leftAt: timestamp("left_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("uq_team_members_team_user").on(table.teamId, table.userId),
]);

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	ownerId: uuid("owner_id").notNull(),
	settings: jsonb().default({"maxMembers":10,"defaultRole":"member","canInviteMembers":true,"allowMemberDeletion":false}),
	status: teamStatus().default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const userPermissions = pgTable("user_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	resource: varchar({ length: 100 }).notNull(),
	action: varchar({ length: 50 }).notNull(),
	allowed: boolean().default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});