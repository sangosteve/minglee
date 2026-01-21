import React, { useState, useEffect, useRef } from "react";
import {
  useConversation,
  useUpdateConversationStatus,
  useMarkAsRead,
  useUnreadCount,
  type Conversation,
  type Message,
} from "@/lib/api/conversations";
import { useQuickReplies } from "@/hooks/use-quick-replies";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import { TooltipProvider } from "@/components/ui/tooltip";

// Components
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ConversationList } from "@/components/chat/ConversationList";
import { ContactHeader } from "@/components/chat/ContactHeader";
import { MessagesContainer } from "@/components/chat/MessagesContainer";
import { MessageInput } from "@/components/chat/MessageInput";
import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { TemplateSelectDialog } from "@/components/chat/TemplateSelectDialog";
import { TemplateVariablesDialog } from "@/components/chat/TemplateVariablesDialog";

// Hooks
import { useConversationsData } from "@/hooks/useConversationsData";
import { useMessageHandlers } from "@/hooks/useMessageHandlers";

// Types
import type { Template } from "@/lib/api/templates";
import { useApprovedTemplates, useSendTemplateMessage } from "@/lib/api/templates";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

const Conversations = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [showTemplateVariables, setShowTemplateVariables] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuthStore();
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    searchQuery,
    setSearchQuery,
    selectedTab,
    setSelectedTab,
    sidebarFilters,
    setSidebarFilters,
    conversations,
    inboxCounts,
    isLoading: conversationsLoading,
    user: currentUser,
  } = useConversationsData();

  const {
    messageInput,
    setMessageInput,
    attachments,
    setAttachments,
    quickReplyMediaAttachments,
    setQuickReplyMediaAttachments,
    caption,
    setCaption,
    isDragging,
    setIsDragging,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment,
    handleClearAllAttachments,
    handleSendMessage: handleSendMessageLogic,
    triggerFileInput,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleEmojiSelect,
    isSending,
  } = useMessageHandlers();

  const { data: quickRepliesData, isLoading: quickRepliesLoading } = useQuickReplies({
    page: 1,
    limit: 100,
    isActive: true,
  });

  const { data: approvedTemplates = [], isLoading: templatesLoading } = useApprovedTemplates();
  const sendTemplateMutation = useSendTemplateMessage();

  const { data: conversationData, isLoading: conversationLoading } = useConversation(
    selectedConversationId || "",
    1,
    50
  );

  const markAsRead = useMarkAsRead();
  const { data: unreadCount } = useUnreadCount();

  const selectedConversation = conversationData?.conversation;
  const messages = conversationData?.messages || [];
  const contact = conversationData?.contact;
  const quickReplies = quickRepliesData?.quickReplies ?? [];

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unreadCount) {
      markAsRead.mutate(selectedConversationId);
    }
  }, [selectedConversationId, selectedConversation?.unreadCount]);

  const handleSendMessage = () => {
    if (selectedConversationId && contact && selectedConversation) {
      handleSendMessageLogic(selectedConversationId, contact, selectedConversation);
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

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateVariables(true);
  };

  const handleSendTemplate = async (variables: Record<string, string>, media?: { type: string; url: string }) => {
    if (!selectedTemplate || !selectedConversationId || !contact) {
      toast({
        title: "Cannot send template",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await sendTemplateMutation.mutateAsync({
        templateId: selectedTemplate.id,
        contactId: contact.id,
        parameters: {
          variables,
          media,
        },
      });

      if (result.success) {
        toast({
          title: "Template message sent!",
          description: "The template has been sent successfully",
        });
      } else {
        toast({
          title: "Failed to send template message",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error sending template:", error);
      toast({
        title: "Failed to send template message",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSelectedTemplate(null);
      setShowTemplateVariables(false);
    }
  };

  const handleSidebarFilterChange = (filters: any) => {
    setSidebarFilters(filters);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  if (conversationsLoading) {
    return (
      <div className="flex h-full bg-card overflow-hidden">
        <ConversationSidebar
          onFilterChange={handleSidebarFilterChange}
          currentUserId={user?.id}
          inboxCounts={inboxCounts}
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
      <div className="flex h-full bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <ConversationSidebar
          onFilterChange={handleSidebarFilterChange}
          currentUserId={currentUser?.id}
          inboxCounts={inboxCounts}
        />

        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          unreadCount={unreadCount}
        />

        <div
          ref={dropZoneRef}
          className="flex-1 flex flex-col relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
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
              <ContactHeader
                contact={contact}
                conversation={selectedConversation}
              />

              <MessagesContainer
                messages={messages}
                isLoading={conversationLoading}
                onDownloadMedia={handleDownloadMedia}
                onViewMedia={handleViewMedia}
              />

              <AttachmentPreview
                attachments={attachments}
                quickReplyMediaAttachments={quickReplyMediaAttachments}
                caption={caption}
                onClearAll={handleClearAllAttachments}
                onRemoveAttachment={handleRemoveAttachment}
                onCaptionChange={setCaption}
              />

              <MessageInput
                value={messageInput}
                onChange={setMessageInput}
                onSend={handleSendMessage}
                onEmojiSelect={handleEmojiSelect}
                onFileSelect={triggerFileInput}
                onTemplateSelect={() => setShowTemplateSelect(true)}
                disabled={isSending}
                isSending={isSending}
                fileInputRef={fileInputRef}
                quickReplies={quickReplies}
                quickRepliesLoading={quickRepliesLoading}
                conversationId={selectedConversationId}
                contact={contact}
                user={currentUser}
                conversation={selectedConversation}
              />
            </>
          ) : (
            <EmptyConversationState />
          )}
        </div>

        {/* Template Dialogs */}
        <TemplateSelectDialog
          open={showTemplateSelect}
          onOpenChange={setShowTemplateSelect}
          onSelectTemplate={handleSelectTemplate}
        />

        <TemplateVariablesDialog
          open={showTemplateVariables}
          onOpenChange={setShowTemplateVariables}
          template={selectedTemplate}
          onSend={handleSendTemplate}
        />
      </div>
    </TooltipProvider>
  );
};

// Helper functions that need to be imported
import { getMediaUrl, getFilename } from "@/components/chat/message-utils";
import { PaperClipIcon } from "@heroicons/react/24/outline";

const EmptyConversationState = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <ChatBubbleLeftRightIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
      <p className="text-muted-foreground">
        Choose a conversation from the list to start messaging
      </p>
    </div>
  </div>
);

export default Conversations;