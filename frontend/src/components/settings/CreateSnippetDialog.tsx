import React, { useState, useRef } from 'react';
import { 
  PaperClipIcon,
  DocumentIcon,
  XCircleIcon,
  PlusIcon
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
  DialogTrigger,
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
import { useToast } from '../ui/use-toast';
import { useCreateQuickReply } from '@/hooks/use-quick-replies';
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

interface CreateSnippetDialogProps {
  onSuccess?: (snippet: { name: string; message: string; files: File[] }) => void;
  trigger?: React.ReactNode;
}

export function CreateSnippetDialog({ onSuccess, trigger }: CreateSnippetDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [topics, setTopics] = useState('General');
  const [isActive, setIsActive] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [showVariables, setShowVariables] = useState(false);
  const [variableSearch, setVariableSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const filteredVariables = variables.filter(
    (v) =>
      v.label.toLowerCase().includes(variableSearch.toLowerCase()) ||
      v.value.toLowerCase().includes(variableSearch.toLowerCase())
  );

  const { toast } = useToast();
  const createQuickReply = useCreateQuickReply();
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

const uploadFiles = async (filesToUpload: File[]): Promise<string[]> => {
  if (!user?.id) {
    throw new Error('User not authenticated');
  }

  if (filesToUpload.length === 0) {
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
    
    console.log('Upload response:', data);
    
    if (data.success && data.data?.uploads) {
      // ✅ Extract DATABASE IDs from the upload response
      const mediaIds = data.data.uploads
        .filter((upload: any) => upload.success && upload.id) // Make sure we have an ID
        .map((upload: any) => upload.id); // Use the database ID

      console.log('Uploaded media DATABASE IDs:', mediaIds);
      
      if (mediaIds.length === 0) {
        throw new Error('No valid media IDs returned from server');
      }
      
      return mediaIds;
    }
    
    throw new Error('Upload response indicates failure');
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  } finally {
    setIsUploading(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');
    
    if (!name.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and message are required",
        variant: "destructive",
      });
      return;
    }

    try {
      let mediaAttachmentIds: string[] = [];
      
      // Upload files if any
      if (files.length > 0) {
        console.log('Uploading files:', files);
        
        try {
          mediaAttachmentIds = await uploadFiles(files);
          console.log('Uploaded media IDs:', mediaAttachmentIds);
          
          if (mediaAttachmentIds.length < files.length) {
            toast({
              title: "Upload Warning",
              description: "Some attachments failed to upload. Creating quick reply without failed attachments.",
              variant: "destructive",
            });
          }
        } catch (uploadError: any) {
          console.error('File upload error:', uploadError);
          toast({
            title: "Upload Error",
            description: "Failed to upload attachments. Creating quick reply without attachments.",
            variant: "destructive",
          });
          // Continue without attachments
        }
      }

      console.log('Creating quick reply with data:', { 
        name, 
        message, 
        topics, 
        isActive, 
        mediaAttachmentIds 
      });

      // Create the quick reply
      const result = await createQuickReply.mutateAsync({
        name: name.trim(),
        message: message.trim(),
        topics: topics.trim(),
        mediaAttachmentIds,
        isActive,
      });

      console.log('Quick reply created successfully:', result);

      toast({
        title: "Quick Reply Created",
        description: `"${name}" has been created successfully`,
      });

      // Call onSuccess callback
      onSuccess?.({ name, message, files });
      
      // Reset form
      setName('');
      setMessage('');
      setTopics('General');
      setIsActive(true);
      setFiles([]);
      setOpen(false);
      
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create quick reply",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusIcon className="w-4 h-4" />
            Add Snippet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Quick Reply</DialogTitle>
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
              disabled={createQuickReply.isPending || isUploading}
            />
          </div>

          {/* Topics and Status Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topics" className="text-foreground">Topics</Label>
              <Select value={topics} onValueChange={setTopics} disabled={createQuickReply.isPending || isUploading}>
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
                disabled={createQuickReply.isPending || isUploading}
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
                disabled={createQuickReply.isPending || isUploading}
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

          {/* File Upload Field */}
          <div className="space-y-2">
            <Label className="text-foreground">Attachments</Label>
            <div
              onClick={() => !createQuickReply.isPending && !isUploading && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed border-input rounded-lg p-4 text-center cursor-pointer",
                "hover:border-primary hover:bg-primary/5 transition-colors",
                (createQuickReply.isPending || isUploading) && "opacity-50 cursor-not-allowed"
              )}
            >
              <PaperClipIcon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to upload files
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Images, Documents
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={createQuickReply.isPending || isUploading}
            />

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2 mt-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <DocumentIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      disabled={createQuickReply.isPending || isUploading}
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Uploading Indicator */}
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                Uploading attachments...
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-input text-foreground hover:bg-muted"
              disabled={createQuickReply.isPending || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !message.trim() || createQuickReply.isPending || isUploading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {(createQuickReply.isPending || isUploading) ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isUploading ? "Uploading..." : "Creating..."}
                </span>
              ) : "Create Quick Reply"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}