import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperClipIcon,
  DocumentIcon,
  XCircleIcon,
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUpdateQuickReply } from '@/hooks/use-quick-replies';
import type { QuickReply } from '@/lib/api/quick-replies';
import { useAuthStore } from '@/stores/auth.store';

interface Variable {
  id: string;
  label: string;
  value: string;
}

const variables: Variable[] = [
  { id: 'id', label: 'ID', value: 'contact.id' },
  { id: 'name', label: 'Name', value: 'contact.name' },
  { id: 'firstname', label: 'First Name', value: 'contact.firstname' },
  { id: 'lastname', label: 'Last Name', value: 'contact.lastname' },
  { id: 'email', label: 'Email', value: 'contact.email' },
  { id: 'phone', label: 'Phone Number', value: 'contact.phone' },
];

interface MediaAttachment {
  id: string;
  publicId: string;
  secureUrl: string;
  url: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  assetType: string;
  resourceType: string;
  caption?: string;
  tags: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface EditSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickReply: QuickReply | null;
  onSuccess?: () => void;
}

export function EditSnippetDialog({ open, onOpenChange, quickReply, onSuccess }: EditSnippetDialogProps) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [topics, setTopics] = useState('General');
  const [isActive, setIsActive] = useState(true);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<MediaAttachment[]>([]);
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([]);
  const [showVariables, setShowVariables] = useState(false);
  const [variableSearch, setVariableSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const updateQuickReply = useUpdateQuickReply();
  const { user } = useAuthStore();

  const filteredVariables = variables.filter(
    (v) =>
      v.label.toLowerCase().includes(variableSearch.toLowerCase()) ||
      v.value.toLowerCase().includes(variableSearch.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Initialize form with quick reply data when dialog opens
  useEffect(() => {
    if (quickReply && open) {
      setName(quickReply.name || '');
      setMessage(quickReply.message || '');
      setTopics(quickReply.topics || 'General');
      setIsActive(quickReply.isActive ?? true);
      
      // Set existing attachments
      const mediaAttachments = quickReply.mediaAttachments || [];
      setExistingAttachments(mediaAttachments);
      setAttachmentsToRemove([]);
      setNewFiles([]);
    }
  }, [quickReply, open]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setMessage(value);
    setCursorPosition(cursorPos);

    // Check if user just typed "$"
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastDollarIndex = textBeforeCursor.lastIndexOf('$');
    
    if (lastDollarIndex !== -1) {
      const textAfterDollar = textBeforeCursor.substring(lastDollarIndex + 1);
      // Show popover if $ is at the end or followed by alphanumeric characters only
      if (textAfterDollar === '' || /^[a-zA-Z0-9.]*$/.test(textAfterDollar)) {
        setVariableSearch(textAfterDollar);
        setShowVariables(true);
        return;
      }
    }
    
    setShowVariables(false);
    setVariableSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showVariables) {
      if (e.key === 'Escape') {
        setShowVariables(false);
        e.preventDefault();
      }
    }
  };

  const insertVariable = (variable: Variable) => {
    const textBeforeCursor = message.substring(0, cursorPosition);
    const lastDollarIndex = textBeforeCursor.lastIndexOf('$');
    const textAfterCursor = message.substring(cursorPosition);
    
    const newMessage = 
      message.substring(0, lastDollarIndex) + 
      `{{${variable.value}}}` + 
      textAfterCursor;
    
    setMessage(newMessage);
    setShowVariables(false);
    setVariableSearch('');
    
    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPosition = lastDollarIndex + variable.value.length + 4; // +4 for {{ and }}
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setNewFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setAttachmentsToRemove(prev => [...prev, attachmentId]);
    setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const restoreAttachment = (attachmentId: string) => {
    setAttachmentsToRemove(prev => prev.filter(id => id !== attachmentId));
    // We would need to fetch the attachment details again here
    // For now, we'll just remove from removal list
  };

  const uploadNewFiles = async (filesToUpload: File[]): Promise<string[]> => {
    if (!user?.id || filesToUpload.length === 0) {
      return [];
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('folder', `quick-replies/user_${user.id}`);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/media/upload-multiple`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.uploads) {
        const mediaIds = data.data.uploads
          .filter((upload: any) => upload.success && upload.id)
          .map((upload: any) => upload.id);

        console.log('Uploaded new media IDs:', mediaIds);
        return mediaIds;
      }
      
      return [];
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quickReply?.id) {
      toast({
        title: "Error",
        description: "No quick reply selected for editing",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and message are required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Start with existing attachment IDs
      let mediaAttachmentIds = existingAttachments.map(att => att.id);
      
      // Upload new files if any
      let newMediaIds: string[] = [];
      if (newFiles.length > 0) {
        try {
          newMediaIds = await uploadNewFiles(newFiles);
          mediaAttachmentIds = [...mediaAttachmentIds, ...newMediaIds];
        } catch (uploadError: any) {
          toast({
            title: "Upload Warning",
            description: "Some new attachments failed to upload. Updating without failed attachments.",
            variant: "destructive",
          });
        }
      }

      // Remove attachments marked for deletion
      mediaAttachmentIds = mediaAttachmentIds.filter(id => 
        !attachmentsToRemove.includes(id)
      );

      await updateQuickReply.mutateAsync({
        id: quickReply.id,
        data: {
          name: name.trim(),
          message: message.trim(),
          topics: topics.trim(),
          isActive,
          mediaAttachmentIds,
        }
      });

      toast({
        title: "Success",
        description: `"${name}" has been updated successfully`,
      });

      onSuccess?.();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error updating quick reply:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update quick reply",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const getFileIcon = (filename: string, mimeType?: string) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.startsWith('video/')) return '🎬';
    if (mimeType?.startsWith('audio/')) return '🎵';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return '📦';
    return '📎';
  };

  const handleViewAttachment = (attachment: MediaAttachment) => {
    const url = attachment.secureUrl || attachment.url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDownloadAttachment = (attachment: MediaAttachment) => {
    const url = attachment.secureUrl || attachment.url;
    const filename = attachment.originalFilename || attachment.filename || 'download';
    
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!quickReply) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground">Edit Quick Reply</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <XMarkIcon className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter quick reply name"
              className="bg-background border-input text-foreground placeholder:text-muted-foreground"
              disabled={updateQuickReply.isPending || isUploading}
            />
          </div>

          {/* Message Field with Variable Support */}
          <div className="space-y-2 relative">
            <Label htmlFor="message" className="text-foreground">Message</Label>
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">$</span> to insert variables
            </p>
            <div className="relative">
              <textarea
                ref={textareaRef}
                id="message"
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter your message..."
                rows={5}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50 resize-none text-foreground"
                )}
                disabled={updateQuickReply.isPending || isUploading}
              />
              
              {/* Variable Dropdown */}
              {showVariables && (
                <div className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg animate-fade-in">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">Select Variable</p>
                    <p className="text-xs text-muted-foreground">Type to search for variable</p>
                  </div>
                  <Command className="bg-transparent">
                    <CommandInput 
                      placeholder="Search variables..." 
                      value={variableSearch}
                      onValueChange={setVariableSearch}
                      className="border-0"
                    />
                    <CommandList>
                      <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
                        No variables found.
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredVariables.map((variable) => (
                          <CommandItem
                            key={variable.id}
                            onSelect={() => insertVariable(variable)}
                            className="cursor-pointer hover:bg-muted px-3 py-2"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{variable.label}</span>
                              <span className="text-xs text-muted-foreground">{variable.value}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
          </div>

          {/* Topics and Status Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topics" className="text-foreground">Topics</Label>
              <Select value={topics} onValueChange={setTopics} disabled={updateQuickReply.isPending || isUploading}>
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Customer Service">Customer Service</SelectItem>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Billing">Billing</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Greeting">Greeting</SelectItem>
                  <SelectItem value="FAQ">FAQ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-foreground">Status</Label>
              <Select 
                value={isActive ? "active" : "inactive"} 
                onValueChange={(value) => setIsActive(value === "active")}
                disabled={updateQuickReply.isPending || isUploading}
              >
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-2">
            <Label className="text-foreground">Attachments</Label>
            
            {/* Existing Attachments */}
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Existing Attachments:</p>
                <div className="space-y-2">
                  {existingAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg",
                        attachmentsToRemove.includes(attachment.id)
                          ? "bg-destructive/10 border border-destructive/20"
                          : "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg">{getFileIcon(attachment.filename, attachment.mimeType)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">
                            {attachment.originalFilename || attachment.filename}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(attachment.fileSize)}</span>
                            <span>•</span>
                            <span>{attachment.mimeType?.split('/')[1] || 'file'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-primary/10"
                          onClick={() => handleViewAttachment(attachment)}
                          title="View"
                        >
                          <EyeIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-primary/10"
                          onClick={() => handleDownloadAttachment(attachment)}
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeExistingAttachment(attachment.id)}
                          title="Remove"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Removed Attachments (for undo) */}
            {attachmentsToRemove.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Removed Attachments:</p>
                <div className="p-2 bg-destructive/5 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">
                    {attachmentsToRemove.length} attachment(s) will be removed
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs p-0 h-auto"
                    onClick={() => {
                      setAttachmentsToRemove([]);
                      // Note: Would need to refetch attachments to restore them
                    }}
                  >
                    Undo all removals
                  </Button>
                </div>
              </div>
            )}

            {/* Add New Files */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Add New Attachments:</p>
              <div
                onClick={() => !updateQuickReply.isPending && !isUploading && fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed border-input rounded-lg p-4 text-center cursor-pointer",
                  "hover:border-primary hover:bg-primary/5 transition-colors",
                  (updateQuickReply.isPending || isUploading) && "opacity-50 cursor-not-allowed"
                )}
              >
                <PaperClipIcon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload files
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Images, Documents, Videos, Audio
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={updateQuickReply.isPending || isUploading}
              />

              {/* New Files List */}
              {newFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {newFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <DocumentIcon className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • {file.type.split('/')[1] || 'file'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNewFile(index)}
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        disabled={updateQuickReply.isPending || isUploading}
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Uploading Indicator */}
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                Uploading new attachments...
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-input text-foreground hover:bg-muted"
              disabled={updateQuickReply.isPending || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !message.trim() || updateQuickReply.isPending || isUploading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateQuickReply.isPending || isUploading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isUploading ? "Uploading..." : "Updating..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4" />
                  Update Quick Reply
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}