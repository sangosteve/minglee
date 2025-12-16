import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useConversations,
  useConversation,
  useSendMessage,
  useUpdateConversationStatus,
  useMarkAsRead,
  useUnreadCount,
  useSendMediaMessage,
  type Conversation,
  type Message,
  conversationsApi,
} from "@/lib/api/conversations";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  BoltIcon,
  PaperClipIcon,
  FaceSmileIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  VideoCameraIcon,
  CheckIcon,
  CheckCircleIcon,
  PhotoIcon,
  PlayIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  FilmIcon,
  ChatBubbleLeftRightIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolid,
  CheckIcon as CheckSolid,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { AssignmentDropdown } from "@/components/chat/AssignmentDropdown";
import { ConversationSidebar, ConversationFilters } from "@/components/chat/ConversationSidebar";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useQuickReplies } from "@/hooks/use-quick-replies";
import QuickRepliesDropdown from "@/components/chat/QuickRepliesDropdown";
import { usePersonalizedQuickReplies } from '@/hooks/use-personalized-quick-replies';





// Helper functions
const getInitials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatTime = (dateString: string) => {
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
  return date.toLocaleDateString();
};

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getFileIconColor = (filename: string) => {
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

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

const hasMediaContent = (message: Message): boolean => {
  const metadata = message.metadata || {};
  return !!(
    metadata.mediaAttachmentId ||
    metadata.cloudinaryUrl ||
    metadata.image ||
    metadata.video ||
    metadata.audio ||
    metadata.document ||
    metadata.location ||
    message.messageType !== 'text'
  );
};

const getMediaType = (message: Message): string => {
  const metadata = message.metadata || {};

  if (message.messageType === 'image' || metadata.image || metadata.mediaType === 'image') return 'image';
  if (message.messageType === 'video' || metadata.video || metadata.mediaType === 'video') return 'video';
  if (message.messageType === 'audio' || metadata.audio || metadata.mediaType === 'audio') return 'audio';
  if (message.messageType === 'document' || metadata.document || metadata.mediaType === 'document') return 'document';
  if (message.messageType === 'sticker' || metadata.sticker) return 'sticker';
  if (message.messageType === 'location' || metadata.location) return 'location';
  if (message.messageType === 'contacts' || metadata.contacts) return 'contacts';

  return 'text';
};

const getMediaUrl = (message: Message): string | undefined => {
  const metadata = message.metadata || {};
  return metadata.cloudinaryUrl ||
    metadata.secureUrl ||
    metadata.url ||
    metadata.image?.url ||
    metadata.video?.url;
};

const getFilename = (message: Message): string => {
  const metadata = message.metadata || {};
  return metadata.originalFilename ||
    metadata.filename ||
    metadata.document?.filename ||
    message.body ||
    'file';
};

const getMessageStatusIcon = (status: string) => {
  switch (status) {
    case "read":
      return <CheckCircleIcon className="w-3.5 h-3.5 text-primary-foreground/70" />;
    case "delivered":
      return <CheckCircleSolid className="w-3.5 h-3.5 text-primary-foreground/70" />;
    case "sent":
      return <CheckSolid className="w-3.5 h-3.5 text-primary-foreground/70" />;
    default:
      return <ExclamationCircleIcon className="w-3.5 h-3.5 text-primary-foreground/70" />;
  }
};

const getStatusIndicator = (status: string) => {
  const statusMap: Record<string, string> = {
    'active': 'bg-success',
    'online': 'bg-success',
    'offline': 'bg-muted-foreground',
    'inactive': 'bg-muted-foreground',
    'archived': 'bg-gray-500',
  };
  return statusMap[status] || 'bg-muted-foreground';
};

const getContactStatus = (contactStatus?: string): "online" | "offline" => {
  if (contactStatus === 'active' || contactStatus === 'online') return 'online';
  return 'offline';
};

type MediaType = "image" | "video" | "audio" | "document" | "compressed";

interface AttachmentPreview {
  file: File;
  type: MediaType;
  previewUrl: string;
}

const getFileType = (file: File): MediaType => {
  const mimeType = file.type;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar") || mimeType.includes("gz")) return "compressed";
  return "document";
};

const Conversations = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<string>("All");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [caption, setCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const {  send: sendQuickReply } = usePersonalizedQuickReplies();
  const [sidebarFilters, setSidebarFilters] = useState<ConversationFilters>({
    inboxType: 'all',
    lifecycle: '',
    status: 'open',
    teamInbox: '',
    customInbox: '',
    viewType: 'chats',
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const {
    data: quickRepliesData,
    isLoading: quickRepliesLoading,
  } = useQuickReplies({
    page: 1,
    limit: 100,
    isActive: true,
  });

  const quickReplies = quickRepliesData?.quickReplies ?? [];


  const { user } = useAuthStore();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch ALL conversations once
  const { data: allConversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', {
      status: selectedTab !== "All" ? selectedTab.toLowerCase() : undefined,
      search: debouncedSearch
    }],
    queryFn: () => conversationsApi.getAllConversations({
      status: selectedTab !== "All" ? selectedTab.toLowerCase() : undefined,
      search: debouncedSearch || undefined,
    }),
    staleTime: 1000 * 30,
  });

  // Fetch assigned conversations (for "Mine" filter)
  const { data: assignedConversationsData, isLoading: assignedLoading } = useQuery({
    queryKey: ['conversations-assigned', { user: user?.id }],
    queryFn: () => conversationsApi.getAssignedConversations(),
    enabled: sidebarFilters.inboxType === 'mine' && !!user?.id,
    staleTime: 1000 * 30,
  });

  // Fetch unassigned conversations (for "Unassigned" filter)
  const { data: unassignedConversationsData, isLoading: unassignedLoading } = useQuery({
    queryKey: ['conversations-unassigned'],
    queryFn: () => conversationsApi.getUnassignedConversations(),
    enabled: sidebarFilters.inboxType === 'unassigned',
    staleTime: 1000 * 30,
  });

  const { data: conversationData, isLoading: conversationLoading } = useConversation(
    selectedConversationId || "",
    1,
    50
  );

  const sendMessage = useSendMessage();
  const sendMediaMessage = useSendMediaMessage();
  const updateStatus = useUpdateConversationStatus();
  const markAsRead = useMarkAsRead();
  const { data: unreadCount } = useUnreadCount();

  // Select the appropriate data based on active filter
  const conversations = useMemo(() => {
    switch (sidebarFilters.inboxType) {
      case 'mine':
        return assignedConversationsData?.conversations || [];
      case 'unassigned':
        return unassignedConversationsData?.conversations || [];
      case 'all':
      default:
        return allConversationsData?.conversations || [];
    }
  }, [
    sidebarFilters.inboxType,
    allConversationsData?.conversations,
    assignedConversationsData?.conversations,
    unassignedConversationsData?.conversations,
  ]);

  const allConversations = allConversationsData?.conversations || [];
  const selectedConversation = conversationData?.conversation;
  const messages = conversationData?.messages || [];
  const contact = conversationData?.contact;

  // Calculate counts for sidebar
  const getInboxCounts = useMemo(() => {
    const currentUserId = user?.id ? String(user.id) : null;

    const mineCount = allConversations.filter(conv => {
      if (!currentUserId || !conv.assignedToUserId) return false;
      return String(conv.assignedToUserId) === currentUserId;
    }).length;

    const unassignedCount = allConversations.filter(conv => {
      return conv.assignedToUserId === null || conv.assignedToUserId === undefined;
    }).length;

    return {
      all: allConversations.length,
      mine: mineCount,
      unassigned: unassignedCount,
    };
  }, [allConversations, user?.id]);

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unreadCount) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Process files for attachment preview
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: AttachmentPreview[] = fileArray.map(file => {
      const type = getFileType(file);
      const previewUrl = type === "image" || type === "video" ? URL.createObjectURL(file) : "";
      return { file, type, previewUrl };
    });
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleClearAllAttachments = () => {
    attachments.forEach(att => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
    setAttachments([]);
    setCaption("");
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId || (!messageInput.trim() && attachments.length === 0)) return;

    try {
      if (attachments.length > 0) {
        const formData = new FormData();

        if (!contact?.phone) {
          toast({
            title: "Cannot send message",
            description: "Contact phone number is missing",
            variant: "destructive",
          });
          return;
        }

        formData.append('phoneNumber', contact.phone);
        formData.append('caption', caption || '');

        if (attachments[0]) {
          formData.append('file', attachments[0].file);
        }

        await sendMediaMessage.mutateAsync(formData);
        handleClearAllAttachments();
      } else {
        await sendMessage.mutateAsync({
          conversationId: selectedConversationId,
          message: messageInput.trim(),
        });
      }

      setMessageInput("");
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const triggerFileInput = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleDownloadMedia = (message: Message) => {
    const mediaUrl = getMediaUrl(message);
    const filename = getFilename(message);

    if (!mediaUrl) {
      toast({
        title: "Download failed",
        description: "Media URL not available",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download started",
      description: `Downloading ${filename}`,
    });
  };

  const handleViewMedia = (message: Message) => {
    const mediaUrl = getMediaUrl(message);
    if (mediaUrl) {
      window.open(mediaUrl, '_blank');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
  };

  const handleSidebarFilterChange = (filters: ConversationFilters) => {
    setSidebarFilters(filters);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const isLoading = conversationsLoading || assignedLoading || unassignedLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-180px)] bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <ConversationSidebar
          onFilterChange={handleSidebarFilterChange}
          currentUserId={user?.id}
          inboxCounts={getInboxCounts}
        />

        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <div className="w-full h-9 bg-secondary rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="flex border-b border-border">
            {["All", "Unassigned", "Assigned", "Unread", "Open", "Resolved"].map((tab) => (
              <div key={tab} className="flex-1 py-3">
                <div className="h-4 bg-secondary rounded mx-2 animate-pulse"></div>
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded animate-pulse"></div>
                  <div className="h-3 bg-secondary rounded animate-pulse w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-secondary/30">
          <div className="text-center">
            <div className="w-16 h-16 bg-secondary rounded-full animate-pulse mx-auto mb-4"></div>
            <div className="h-4 w-48 bg-secondary rounded animate-pulse mx-auto mb-2"></div>
            <div className="h-3 w-64 bg-secondary rounded animate-pulse mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-180px)] bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <ConversationSidebar
          onFilterChange={handleSidebarFilterChange}
          currentUserId={user?.id}
          inboxCounts={getInboxCounts}
        />

        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-10"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-auto"
                  >
                    <FunnelIcon className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Advanced filters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-border">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="All" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="Unread" className="text-xs">
                  Unread
                  {unreadCount && unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 w-4 p-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="Open" className="text-xs">Open</TabsTrigger>
                <TabsTrigger value="Resolved" className="text-xs">Resolved</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <ChatBubbleLeftRightIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No conversations found</p>
                {sidebarFilters.inboxType === 'mine' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You don't have any assigned conversations
                  </p>
                )}
                {sidebarFilters.inboxType === 'unassigned' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    All conversations are assigned
                  </p>
                )}
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Try a different search term
                  </p>
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                const contact = conv.contact;
                const contactStatus = getContactStatus(contact?.status);

                return (
                  <Button
                    key={conv.id}
                    variant="ghost"
                    className={cn(
                      "w-full flex items-center gap-3 p-4 h-auto hover:bg-secondary/50 transition-colors border-b border-border rounded-none",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => setSelectedConversationId(conv.id)}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {getInitials(contact?.name)}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
                          getStatusIndicator(contactStatus)
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">
                          {contact?.name || contact?.phone || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="flex-shrink-0 w-5 h-5 p-0 flex items-center justify-center">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </Badge>
                    )}
                  </Button>
                );
              })
            )}
          </ScrollArea>
        </div>

        <div
          ref={dropZoneRef}
          className="flex-1 flex flex-col relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="text-center">
                <PaperClipIcon className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-primary font-medium">Drop files here</p>
                <p className="text-sm text-muted-foreground">Release to attach files</p>
              </div>
            </div>
          )}

          {selectedConversation && contact ? (
            <>
              <div className="h-16 px-6 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {getInitials(contact?.name)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card",
                        getStatusIndicator(getContactStatus(contact?.status))
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {contact?.name || contact?.phone || "Unknown"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {contact?.phone || "No phone"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AssignmentDropdown
                    conversationId={selectedConversation.id}
                    currentAssignment={selectedConversation.assignedToUserId}
                    onAssignmentChange={() => {
                      // Invalidate queries to refresh data
                    }}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <PhoneIcon className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Call</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <VideoCameraIcon className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Video call</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <EllipsisVerticalIcon className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>More options</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6 bg-secondary/30">
                {conversationLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`w-2/3 h-16 bg-secondary rounded-2xl animate-pulse ${i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'}`}></div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start the conversation!
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isOutgoing = message.direction === "outgoing";
                      const hasMedia = hasMediaContent(message);
                      const mediaType = getMediaType(message);
                      const mediaUrl = getMediaUrl(message);
                      const filename = getFilename(message);

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex mb-4",
                            isOutgoing ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[280px] rounded-2xl overflow-hidden",
                              hasMedia ? "p-0" : "px-4 py-2.5",
                              isOutgoing
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-card border border-border text-foreground rounded-bl-md"
                            )}
                          >
                            {hasMedia && (
                              <div className="relative">
                                {mediaType === "image" && mediaUrl && (
                                  <div className="relative">
                                    <img
                                      src={mediaUrl}
                                      alt={message.body || "Image"}
                                      className="w-full h-auto object-cover cursor-pointer"
                                      onClick={() => handleViewMedia(message)}
                                    />
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                          onClick={() => handleDownloadMedia(message)}
                                        >
                                          <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}

                                {mediaType === "video" && mediaUrl && (
                                  <div className="relative w-full aspect-video bg-black/90 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                                          onClick={() => handleViewMedia(message)}
                                        >
                                          <PlayIcon className="w-7 h-7 text-white ml-1" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Play video</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                          onClick={() => handleDownloadMedia(message)}
                                        >
                                          <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download video</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs">
                                      <VideoCameraIcon className="w-4 h-4" />
                                      <span>{message.metadata?.duration || "0:00"}</span>
                                    </div>
                                  </div>
                                )}

                                {mediaType === "audio" && (
                                  <div className={cn(
                                    "w-full p-3",
                                    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
                                  )}>
                                    <div className="flex items-center gap-3">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                              isOutgoing ? "bg-primary-foreground/20" : "bg-primary/10"
                                            )}
                                            onClick={() => handleDownloadMedia(message)}
                                          >
                                            <PlayIcon className={cn(
                                              "w-5 h-5 ml-0.5",
                                              isOutgoing ? "text-primary-foreground" : "text-primary"
                                            )} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Play audio</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-1 mb-1">
                                          {[...Array(20)].map((_, i) => (
                                            <div
                                              key={i}
                                              className={cn(
                                                "w-1 rounded-full",
                                                isOutgoing ? "bg-primary-foreground/40" : "bg-primary/40"
                                              )}
                                              style={{ height: `${Math.random() * 16 + 4}px` }}
                                            />
                                          ))}
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className={cn(
                                            "text-xs",
                                            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                                          )}>
                                            {message.metadata?.duration || "0:00"}
                                          </span>
                                          <MusicalNoteIcon className={cn(
                                            "w-3.5 h-3.5",
                                            isOutgoing ? "text-primary-foreground/50" : "text-muted-foreground/50"
                                          )} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {(mediaType === "document" || mediaType === "sticker") && (
                                  <div className={cn(
                                    "w-full p-3",
                                    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
                                  )}>
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                        getFileIconColor(filename).bg
                                      )}>
                                        {mediaType === "sticker" ? (
                                          <ArchiveBoxIcon className="text-amber-500" />
                                        ) : (
                                          <DocumentIcon className={getFileIconColor(filename).text} />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={cn(
                                          "text-sm font-medium truncate",
                                          isOutgoing ? "text-primary-foreground" : "text-foreground"
                                        )}>
                                          {filename}
                                        </p>
                                        <p className={cn(
                                          "text-xs",
                                          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>
                                          {formatFileSize(message.metadata?.fileSize)}
                                        </p>
                                      </div>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                              "p-2 rounded-full transition-colors",
                                              isOutgoing ? "hover:bg-primary-foreground/10" : "hover:bg-muted"
                                            )}
                                            onClick={() => handleDownloadMedia(message)}
                                          >
                                            <ArrowDownTrayIcon className={cn(
                                              "w-4 h-4",
                                              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                                            )} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Download file</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                )}

                                {mediaType === "location" && (
                                  <div className={cn(
                                    "w-full p-3",
                                    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
                                  )}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                        📍
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={cn(
                                          "text-sm font-medium",
                                          isOutgoing ? "text-primary-foreground" : "text-foreground"
                                        )}>
                                          Location Shared
                                        </p>
                                        <p className={cn(
                                          "text-xs truncate",
                                          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>
                                          {message.metadata?.location?.name || message.metadata?.location?.address || message.body || 'Shared location'}
                                        </p>
                                      </div>
                                    </div>
                                    {message.metadata?.location && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button className={cn(
                                            "mt-2 w-full py-1.5 text-sm rounded-lg transition-colors",
                                            isOutgoing ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                                              : "bg-primary/10 text-primary hover:bg-primary/20"
                                          )}>
                                            View on Map
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Open location in maps</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}

                                {message.body && hasMedia && (
                                  <div className="px-3 py-2">
                                    <p className={cn(
                                      "text-sm",
                                      isOutgoing ? "text-primary-foreground" : "text-foreground"
                                    )}>
                                      {message.body}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {message.body && !hasMedia && (
                              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                            )}

                            <div className={cn(
                              "flex items-center gap-1 px-3 pb-2",
                              hasMedia ? "" : "px-0 pb-0 mt-1",
                              isOutgoing ? "justify-end" : "justify-start"
                            )}>
                              <span className={cn(
                                "text-xs",
                                isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {formatMessageTime(message.timestamp)}
                              </span>
                              {isOutgoing && getMessageStatusIcon(message.status)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </ScrollArea>

              {attachments.length > 0 && (
                <div className="p-4 pb-0">
                  <div className="bg-secondary rounded-xl p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-foreground">
                        {attachments.length} file{attachments.length > 1 ? "s" : ""} attached
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                        onClick={handleClearAllAttachments}
                      >
                        Clear all
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="relative group">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors shadow-md z-10 opacity-0 group-hover:opacity-100"
                                onClick={() => handleRemoveAttachment(index)}
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove attachment</p>
                            </TooltipContent>
                          </Tooltip>

                          {attachment.type === "image" && (
                            <img
                              src={attachment.previewUrl}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          )}
                          {attachment.type === "video" && (
                            <div className="w-16 h-16 bg-black/80 rounded-lg flex items-center justify-center relative overflow-hidden">
                              <video src={attachment.previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                              <FilmIcon className="w-6 h-6 text-white relative z-10" />
                            </div>
                          )}
                          {attachment.type === "audio" && (
                            <div className="w-16 h-16 bg-purple-500/20 rounded-lg flex flex-col items-center justify-center p-1">
                              <MusicalNoteIcon className="w-5 h-5 text-purple-500" />
                              <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">{attachment.file.name.slice(0, 8)}...</span>
                            </div>
                          )}
                          {attachment.type === "document" && (
                            <div className="w-16 h-16 bg-blue-500/20 rounded-lg flex flex-col items-center justify-center p-1">
                              <DocumentIcon className="w-5 h-5 text-blue-500" />
                              <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">{attachment.file.name.slice(0, 8)}...</span>
                            </div>
                          )}
                          {attachment.type === "compressed" && (
                            <div className="w-16 h-16 bg-amber-500/20 rounded-lg flex flex-col items-center justify-center p-1">
                              <ArchiveBoxIcon className="w-5 h-5 text-amber-500" />
                              <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">{attachment.file.name.slice(0, 8)}...</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Input
                      type="text"
                      placeholder="Add a caption for all files..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3">
                 <QuickRepliesDropdown
  quickReplies={quickReplies}
  isLoading={quickRepliesLoading}
  onSelect={(message) => {
    setMessageInput((prev) =>
      prev ? `${prev} ${message}` : message
    );
  }}
  conversationId={selectedConversationId || undefined}
  contact={contact}
  sendQuickReply={sendQuickReply}
/>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <PaperClipIcon className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Attach files</p>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="start" className="w-48 bg-card border-border z-50" sideOffset={8}>
                      <DropdownMenuItem
                        onClick={() => triggerFileInput("image/*")}
                        className="cursor-pointer hover:bg-secondary"
                      >
                        <PhotoIcon className="w-4 h-4 mr-2" />
                        Photos
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => triggerFileInput("video/*")}
                        className="cursor-pointer hover:bg-secondary"
                      >
                        <FilmIcon className="w-4 h-4 mr-2" />
                        Videos
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => triggerFileInput("audio/*")}
                        className="cursor-pointer hover:bg-secondary"
                      >
                        <MusicalNoteIcon className="w-4 h-4 mr-2" />
                        Audio
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => triggerFileInput(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv")}
                        className="cursor-pointer hover:bg-secondary"
                      >
                        <DocumentIcon className="w-4 h-4 mr-2" />
                        Documents
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => triggerFileInput(".zip,.rar,.7z,.tar,.gz")}
                        className="cursor-pointer hover:bg-secondary"
                      >
                        <ArchiveBoxIcon className="w-4 h-4 mr-2" />
                        Compressed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={sendMessage.isPending || sendMediaMessage.isPending}
                      className="w-full pr-10"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                          <FaceSmileIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Emoji</p>
                      </TooltipContent>
                    </Tooltip>
                    {showEmojiPicker && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowEmojiPicker(false)}
                        />
                        <EmojiPicker
                          onEmojiSelect={handleEmojiSelect}
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      </>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && attachments.length === 0) || sendMessage.isPending || sendMediaMessage.isPending}
                        className="p-3"
                      >
                        {sendMessage.isPending || sendMediaMessage.isPending ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <PaperAirplaneIcon className="w-5 h-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Send message</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ChatBubbleLeftRightIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>

        {selectedConversation && contact && (
          <div className="w-72 border-l border-border p-6 hidden xl:block">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-semibold text-primary">
                  {getInitials(contact?.name)}
                </span>
              </div>
              <h3 className="font-semibold text-foreground">
                {contact?.name || "Unknown"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {contact?.phone || "No phone"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Contact Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{contact?.email || "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-foreground">
                      {contact?.city || contact?.country ? `${contact.city || ''}${contact.city && contact.country ? ', ' : ''}${contact.country || ''}` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Source</span>
                    <span className="text-foreground capitalize">{contact?.source || "whatsapp"}</span>
                  </div>
                </div>
              </div>

              {contact?.tags && contact.tags.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="px-2 py-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground">
                  {contact?.note || "No notes available"}
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Conversation Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="text-foreground">{messages.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last active</span>
                    <span className="text-foreground">
                      {formatTime(selectedConversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">
                      {new Date(selectedConversation.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Conversations;