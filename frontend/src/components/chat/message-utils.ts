import { Message } from "@/lib/api/conversations";
import {
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";

// Helper functions
export const getInitials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getFileIconColor = (filename: string) => {
  if (!filename) return { bg: "bg-primary/20", text: "text-primary" };
  if (filename.endsWith('.pdf')) return { bg: "bg-red-500/20", text: "text-red-500" };
  if (filename.endsWith('.docx') || filename.endsWith('.doc')) return { bg: "bg-blue-500/20", text: "text-blue-500" };
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return { bg: "bg-green-500/20", text: "text-green-500" };
  if (filename.endsWith('.pptx') || filename.endsWith('.ppt')) return { bg: "bg-orange-500/20", text: "text-orange-500" };
  if (filename.endsWith('.csv')) return { bg: "bg-emerald-500/20", text: "text-emerald-500" };
  if (filename.endsWith('.zip') || filename.endsWith('.rar') || filename.endsWith('.tar') || filename.endsWith('.gz'))
    return { bg: "bg-amber-500/20", text: "text-amber-500" };
  return { bg: "bg-primary/20", text: "text-primary" };
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

export const getMediaType = (message: Message): string => {
  const metadata = message.metadata || {};
  const messageType = message.messageType?.toLowerCase();

  // Return the actual message type if it's a known type
  if (['image', 'video', 'audio', 'document', 'sticker', 'location', 'contacts'].includes(messageType)) {
    return messageType;
  }

  // Check for interactive messages
  if (messageType === 'interactive' || metadata.interactive) {
    return 'interactive';
  }

  // Check for button messages
  if (messageType === 'button' || metadata.button) {
    return 'button';
  }

  // Check metadata for type
  if (metadata.image || metadata.mediaType === 'image') return 'image';
  if (metadata.video || metadata.mediaType === 'video') return 'video';
  if (metadata.audio || metadata.mediaType === 'audio') return 'audio';
  if (metadata.document || metadata.mediaType === 'document') return 'document';
  if (metadata.sticker) return 'sticker';
  if (metadata.location) return 'location';
  if (metadata.contacts) return 'contacts';

  // Default to text
  return 'text';
};

export const hasMediaContent = (message: Message): boolean => {
  const metadata = message.metadata || {};
  const messageType = message.messageType?.toLowerCase();

  // Check for media types
  const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
  if (mediaTypes.includes(messageType)) {
    return true;
  }

  // Check for media in metadata
  return !!(
    metadata.mediaAttachmentId ||
    metadata.cloudinaryUrl ||
    metadata.secureUrl ||
    metadata.url ||
    metadata.image ||
    metadata.video ||
    metadata.audio ||
    metadata.document ||
    metadata.media
  );
};

export const getMediaUrl = (message: Message): string | undefined => {
  const metadata = message.metadata || {};
  return metadata.cloudinaryUrl ||
    metadata.secureUrl ||
    metadata.url ||
    metadata.image?.url ||
    metadata.video?.url ||
    metadata.audio?.url ||
    metadata.document?.url;
};

export const getFilename = (message: Message): string => {
  const metadata = message.metadata || {};
  return metadata.originalFilename ||
    metadata.filename ||
    metadata.document?.filename ||
    message.body ||
    'file';
};

export const getStatusIndicator = (status: string) => {
  const statusMap: Record<string, string> = {
    'active': 'bg-success',
    'online': 'bg-success',
    'offline': 'bg-muted-foreground',
    'inactive': 'bg-muted-foreground',
    'archived': 'bg-gray-500',
  };
  return statusMap[status] || 'bg-muted-foreground';
};

export const getContactStatus = (contactStatus?: string): "online" | "offline" => {
  if (contactStatus === 'active' || contactStatus === 'online') return 'online';
  return 'offline';
};

export const getFileType = (file: File): "image" | "video" | "audio" | "document" | "compressed" => {
  const mimeType = file.type;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar") || mimeType.includes("gz")) return "compressed";
  return "document";
};