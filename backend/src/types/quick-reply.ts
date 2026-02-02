
import { mediaAttachments, quickReplies } from '../db/schema';

export type QuickReply = typeof quickReplies.$inferSelect;
export type NewQuickReply = typeof quickReplies.$inferInsert;

export interface QuickReplyWithAttachments extends QuickReply {
  mediaAttachments: typeof mediaAttachments.$inferSelect[];
}

export interface CreateQuickReplyDTO {
  name: string;
  message: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface UpdateQuickReplyDTO {
  name?: string;
  message?: string;
  topics?: string;
  mediaAttachmentIds?: string[];
  isActive?: boolean;
}

export interface QuickReplyFilters {
  page?: number;
  limit?: number;
  search?: string;
  topics?: string[];
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QuickRepliesResponse {
  success: boolean;
  quickReplies: QuickReply[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}