import { useState, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { useSendMessage, useSendMediaMessage, type Message } from "@/lib/api/conversations";
import { VariableService } from '@/lib/variable-service';
import { getFileType } from "@/components/chat/message-utils";


export type AttachmentPreview = {
  file: File;
  type: "image" | "video" | "audio" | "document" | "compressed";
  previewUrl: string;
};

export const useMessageHandlers = () => {
  const [messageInput, setMessageInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [quickReplyMediaAttachments, setQuickReplyMediaAttachments] = useState<any[]>([]);
  const [caption, setCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();
  const sendMediaMessage = useSendMediaMessage();

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: AttachmentPreview[] = fileArray.map(file => {
      const type = getFileType(file);
      const previewUrl = type === "image" || type === "video" ? URL.createObjectURL(file) : "";
      return { file, type, previewUrl };
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    // Clear quick reply media if adding local files
    if (fileArray.length > 0) {
      setQuickReplyMediaAttachments([]);
    }
  }, []);

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
    setQuickReplyMediaAttachments([]);
    setCaption("");
  };

  const handleSendMessage = async (
    selectedConversationId: string | null,
    contact: any,
    selectedConversation: any
  ) => {
    if (!selectedConversationId || (!messageInput.trim() && attachments.length === 0 && quickReplyMediaAttachments.length === 0)) return;

    try {
      let finalMessage = messageInput.trim();
      let captionForMedia = caption.trim();

      // Check if message contains variables that need personalization
      if (messageInput.includes('{{') && contact && user) {
        // Personalize variables on client-side before sending
        const personalizedMessage = VariableService.replaceVariables(
          messageInput,
          { contact, user, conversation: selectedConversation }
        );

        finalMessage = personalizedMessage.trim();

        // Update input field to show what's being sent
        if (messageInput !== finalMessage) {
          setMessageInput(finalMessage);
        }
      }

      // Also personalize caption if it has variables
      if (caption.includes('{{') && contact && user) {
        const personalizedCaption = VariableService.replaceVariables(
          caption,
          { contact, user, conversation: selectedConversation }
        );

        captionForMedia = personalizedCaption.trim();

        if (caption !== captionForMedia) {
          setCaption(captionForMedia);
        }
      }

      // Priority: Quick reply media attachments > local attachments
      if (quickReplyMediaAttachments.length > 0) {
        // Format quick reply media attachments for backend
        const formattedAttachments = quickReplyMediaAttachments.map((media, index) => ({
          id: media.id,
          secureUrl: media.secureUrl || media.url,
          url: media.secureUrl || media.url,
          mimeType: media.mimeType,
          originalFilename: media.originalFilename || media.filename,
          filename: media.filename || media.originalFilename,
          fileSize: media.fileSize,
          width: media.width,
          height: media.height,
          duration: media.duration,
          caption: captionForMedia,
        }));

        // Send quick reply with pre-uploaded media
        await sendMessage.mutateAsync({
          conversationId: selectedConversationId,
          message: captionForMedia,
          attachments: formattedAttachments,
        });

        // Clear quick reply media and caption
        setQuickReplyMediaAttachments([]);
        setCaption("");
        setMessageInput("");

      } else if (attachments.length > 0) {
        // Send local media files
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
        formData.append('caption', captionForMedia || '');

        if (attachments[0]) {
          formData.append('file', attachments[0].file);
        }

        await sendMediaMessage.mutateAsync(formData);
        handleClearAllAttachments();
      } else {
        // Plain text message (no media)
        await sendMessage.mutateAsync({
          conversationId: selectedConversationId,
          message: finalMessage,
          attachments: [],
        });
      }

      setMessageInput("");
      setCaption("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const triggerFileInput = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
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

  return {
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
    processFiles,
    handleFileSelect,
    handleRemoveAttachment,
    handleClearAllAttachments,
    handleSendMessage,
    triggerFileInput,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleEmojiSelect,
    isSending: sendMessage.isPending || sendMediaMessage.isPending,
  };
};