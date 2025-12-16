import { relations } from "drizzle-orm/relations";
import { users, apiKeys, messages, mediaAttachments, contacts, conversations, refreshTokens, tags, quickReplies } from "./schema";

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	apiKeys: many(apiKeys),
	mediaAttachments: many(mediaAttachments),
	conversations_userId: many(conversations, {
		relationName: "conversations_userId_users_id"
	}),
	conversations_assignedToUserId: many(conversations, {
		relationName: "conversations_assignedToUserId_users_id"
	}),
	refreshTokens: many(refreshTokens),
	tags: many(tags),
	contacts: many(contacts),
	quickReplies: many(quickReplies),
}));

export const mediaAttachmentsRelations = relations(mediaAttachments, ({one, many}) => ({
	message: one(messages, {
		fields: [mediaAttachments.messageId],
		references: [messages.id],
		relationName: "mediaAttachments_messageId_messages_id"
	}),
	user: one(users, {
		fields: [mediaAttachments.uploadedByUserId],
		references: [users.id]
	}),
	messages: many(messages, {
		relationName: "messages_mediaAttachmentId_mediaAttachments_id"
	}),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	mediaAttachments: many(mediaAttachments, {
		relationName: "mediaAttachments_messageId_messages_id"
	}),
	contact: one(contacts, {
		fields: [messages.contactId],
		references: [contacts.id]
	}),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	mediaAttachment: one(mediaAttachments, {
		fields: [messages.mediaAttachmentId],
		references: [mediaAttachments.id],
		relationName: "messages_mediaAttachmentId_mediaAttachments_id"
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	contact: one(contacts, {
		fields: [conversations.contactId],
		references: [contacts.id]
	}),
	user_userId: one(users, {
		fields: [conversations.userId],
		references: [users.id],
		relationName: "conversations_userId_users_id"
	}),
	user_assignedToUserId: one(users, {
		fields: [conversations.assignedToUserId],
		references: [users.id],
		relationName: "conversations_assignedToUserId_users_id"
	}),
	messages: many(messages),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	conversations: many(conversations),
	messages: many(messages),
	user: one(users, {
		fields: [contacts.userId],
		references: [users.id]
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({one}) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id]
	}),
}));

export const tagsRelations = relations(tags, ({one}) => ({
	user: one(users, {
		fields: [tags.userId],
		references: [users.id]
	}),
}));

export const quickRepliesRelations = relations(quickReplies, ({one}) => ({
	user: one(users, {
		fields: [quickReplies.userId],
		references: [users.id]
	}),
}));