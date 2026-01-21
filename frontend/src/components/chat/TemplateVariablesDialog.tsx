// frontend/src/components/chat/TemplateVariablesDialog.tsx
import { useState, useEffect, useRef } from "react";
import { Template } from "@/lib/api/templates";
import { mediaApi } from "@/lib/api/media";
import { useAuthStore } from "@/stores/auth.store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Video, File, Upload, X, Loader2, Send, Lock } from "lucide-react";

// Available system variables
const SYSTEM_VARIABLES = [
  { key: "contact.name", label: "Contact Name", description: "Full name of the contact" },
  { key: "contact.first_name", label: "First Name", description: "First name of the contact" },
  { key: "contact.last_name", label: "Last Name", description: "Last name of the contact" },
  { key: "contact.phone", label: "Phone Number", description: "Contact's phone number" },
  { key: "contact.email", label: "Email", description: "Contact's email address" },
  { key: "contact.company", label: "Company", description: "Contact's company name" },
  { key: "business.name", label: "Business Name", description: "Your business name" },
  { key: "business.phone", label: "Business Phone", description: "Your business phone" },
  { key: "business.website", label: "Website", description: "Your business website" },
  { key: "date.today", label: "Today's Date", description: "Current date" },
  { key: "date.time", label: "Current Time", description: "Current time" },
];

interface VariableInput {
  name: string;
  variable: string;
  value: string;
  fallback: string;
}

interface VariableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onVariableSelected?: () => void;
}

function VariableDropdown({ value, onChange, placeholder, disabled, onVariableSelected }: VariableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);


  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(newCursorPosition);

    // Check if user typed $ to open dropdown
    const textBeforeCursor = newValue.substring(0, newCursorPosition);
    const lastDollarIndex = textBeforeCursor.lastIndexOf("$");
    
    if (lastDollarIndex !== -1) {
      const searchText = textBeforeCursor.substring(lastDollarIndex + 1);
      setFilterText(searchText.toLowerCase());
      setOpen(true);
    } else {
      setOpen(false);
      setFilterText("");
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const lastDollarIndex = textBeforeCursor.lastIndexOf("$");
    
    if (lastDollarIndex !== -1) {
      const searchText = textBeforeCursor.substring(lastDollarIndex + 1);
      setFilterText(searchText.toLowerCase());
      setOpen(true);
    }
  };

  const handleSelectVariable = (variable: typeof SYSTEM_VARIABLES[0]) => {
    const currentValue = value;
    
    // Find the last $ before cursor position
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastDollarIndex = textBeforeCursor.lastIndexOf("$");
    
    if (lastDollarIndex !== -1) {
      // Replace from $ to cursor position with the variable
      const beforeDollar = currentValue.substring(0, lastDollarIndex);
      const afterCursor = currentValue.substring(cursorPosition);
      const newValue = beforeDollar + `{{${variable.key}}}` + afterCursor;
      
      onChange(newValue);
      setOpen(false);
      setFilterText("");
      
      // Notify parent that a variable was selected
      if (onVariableSelected) {
        onVariableSelected();
      }
      
      // Focus input and set cursor after inserted variable
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = lastDollarIndex + `{{${variable.key}}}`.length;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 10);
    } else {
      // Just append variable at cursor position
      const beforeCursor = currentValue.substring(0, cursorPosition);
      const afterCursor = currentValue.substring(cursorPosition);
      const newValue = beforeCursor + `{{${variable.key}}}` + afterCursor;
      
      onChange(newValue);
      setOpen(false);
      setFilterText("");
      
      // Notify parent that a variable was selected
      if (onVariableSelected) {
        onVariableSelected();
      }
      
      // Focus input and set cursor after inserted variable
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = cursorPosition + `{{${variable.key}}}`.length;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 10);
    }
  };

  const filteredVariables = SYSTEM_VARIABLES.filter(
    (v) =>
      v.key.toLowerCase().includes(filterText) ||
      v.label.toLowerCase().includes(filterText) ||
      v.description.toLowerCase().includes(filterText)
  );

  return (
    <div className="relative" ref={popoverRef}>
      <Input
        ref={inputRef}
        placeholder={placeholder || "Type $ to insert variable"}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        className="text-sm"
        disabled={disabled}
      />
      
      {open && (
        <div className="absolute z-50 w-72 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <p className="text-xs text-muted-foreground">
              Select a variable or continue typing to filter
              {filterText && (
                <span className="ml-1 font-medium">
                  Filtering: "{filterText}"
                </span>
              )}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="p-1">
              {filteredVariables.length > 0 ? (
                filteredVariables.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => handleSelectVariable(variable)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <div className="font-medium text-sm">{variable.label}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                        {`{{${variable.key}}}`}
                      </code>
                      <span className="truncate">{variable.description}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No variables found for "{filterText}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TemplateVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSend: (variables: Record<string, string>, media?: { type: string; url: string }) => void;
}

export function TemplateVariablesDialog({
  open,
  onOpenChange,
  template,
  onSend,
}: TemplateVariablesDialogProps) {
  const [variables, setVariables] = useState<VariableInput[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeVariableIndex, setActiveVariableIndex] = useState<number | null>(null);
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const variableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isSending, setIsSending] = useState(false);
  // Scroll to active variable
  useEffect(() => {
    if (activeVariableIndex !== null && variableRefs.current[activeVariableIndex]) {
      const element = variableRefs.current[activeVariableIndex];
      if (element && scrollContainerRef.current) {
        // Calculate position relative to scroll container
        const container = scrollContainerRef.current;
        const elementTop = element.offsetTop;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const elementHeight = element.clientHeight;
        
        // If element is not in view, scroll to it
        if (elementTop < containerScrollTop || 
            elementTop + elementHeight > containerScrollTop + containerHeight) {
          container.scrollTo({
            top: elementTop - 20, // Add some padding
            behavior: 'smooth'
          });
        }
      }
    }
  }, [activeVariableIndex]);

  useEffect(() => {
    if (template) {
      // Extract variables from template
      const newVariables: VariableInput[] = [];
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      
      // First check for named parameters (new format)
      if (bodyComponent?.example?.body_text_named_params) {
        bodyComponent.example.body_text_named_params.forEach((param: any) => {
          newVariables.push({
            name: param.param_name,
            variable: '',
            value: param.example || '',
            fallback: param.example || '',
          });
        });
      }
      // Then check for numbered parameters ({{1}}, {{2}}, etc.)
      else if (bodyComponent?.example?.body_text) {
        const positionGroups = bodyComponent.example.body_text;
        if (positionGroups && positionGroups.length > 0) {
          const exampleGroup = positionGroups[0];
          exampleGroup.forEach((example: string, index: number) => {
            newVariables.push({
              name: index.toString(),
              variable: '',
              value: example || '',
              fallback: example || '',
            });
          });
        }
      }
      // Fallback to regex extraction
      else if (bodyComponent?.text) {
        // Extract both {{variable_name}} and {{1}}, {{2}} patterns
        const matches = bodyComponent.text.match(/\{\{([^}]+)\}\}/g) || [];
        const seen = new Set<string>();
        matches.forEach((match: string) => {
          const varName = match.replace(/\{\{|\}\}/g, '');
          if (!seen.has(varName)) {
            seen.add(varName);
            newVariables.push({
              name: varName,
              variable: '',
              value: '',
              fallback: '',
            });
          }
        });
      }
      
      setVariables(newVariables);
      setMediaFile(null);
      setMediaPreview(null);
      setUploadError(null);
      setActiveVariableIndex(null);
      
      // Reset refs array
      variableRefs.current = [];
      
      // Auto-scroll to top when template changes
      if (scrollContainerRef.current) {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
        }, 100);
      }
    }
  }, [template]);

  if (!template) return null;

  const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
  const hasMedia = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format);
  const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
  const footerComponent = template.components?.find((c: any) => c.type === 'FOOTER');

  const handleVariableFieldChange = (name: string, variable: string) => {
    setVariables(prev =>
      prev.map(v => (v.name === name ? { ...v, variable } : v))
    );
  };

  const handleValueChange = (name: string, value: string) => {
    setVariables(prev =>
      prev.map(v => (v.name === name ? { ...v, value } : v))
    );
  };

  const handleFallbackChange = (name: string, fallback: string) => {
    setVariables(prev =>
      prev.map(v => (v.name === name ? { ...v, fallback } : v))
    );
  };

  const handleVariableSelected = (name: string, index: number) => {
    // Set this variable as active for scrolling
    setActiveVariableIndex(index);
  };

  const handleClearVariable = (name: string) => {
    setVariables(prev =>
      prev.map(v => (v.name === name ? { ...v, variable: '', value: '' } : v))
    );
  };

  const getMediaAccept = (format?: string): string => {
    if (!format) return '';
    switch (format) {
      case 'IMAGE': return 'image/*';
      case 'VIDEO': return 'video/*';
      case 'DOCUMENT': return '.pdf,.doc,.docx,.txt,.zip,.rar';
      default: return '';
    }
  };

  const isValidFileType = (file: File, format?: string): boolean => {
    if (!format) return true;
    
    const accept = getMediaAccept(format);
    const acceptPatterns = accept.split(',');
    
    for (const pattern of acceptPatterns) {
      const trimmedPattern = pattern.trim();
      
      if (trimmedPattern.includes('/*')) {
        const mimePrefix = trimmedPattern.split('/*')[0];
        if (file.type.startsWith(mimePrefix)) {
          return true;
        }
      } else if (trimmedPattern === file.type) {
        return true;
      } else if (trimmedPattern.startsWith('.')) {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (fileExtension === trimmedPattern.toLowerCase()) {
          return true;
        }
      }
    }
    
    return false;
  };

  const getFileTypeDescription = (format?: string): string => {
    if (!format) return '';
    switch (format) {
      case 'IMAGE': return 'Images (.jpg, .png, .gif, .webp)';
      case 'VIDEO': return 'Videos (.mp4, .avi, .mov, .webm)';
      case 'DOCUMENT': return 'Documents (.pdf, .doc, .docx, .txt)';
      default: return 'Any file';
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setUploadError(`File too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      
      if (headerComponent) {
        if (!isValidFileType(file, headerComponent.format)) {
          setUploadError(`Invalid file type. Please select a ${getFileTypeDescription(headerComponent.format)} file.`);
          return;
        }
      }
      
      setMediaFile(file);
      setUploadError(null);
      
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    setUploadError(null);
  };

  const uploadMediaToCloudinary = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const folder = `whatsapp_templates/user_${user?.id}`;
      const response = await mediaApi.uploadMultipleFiles([file], folder);
      
      if (!response.success || !response.data.uploads?.[0]?.success) {
        throw new Error(response.data.uploads?.[0]?.error || 'Upload failed');
      }
      
      const uploadedFile = response.data.uploads[0];
      const secureUrl = uploadedFile.secureUrl || uploadedFile.url;
      if (!secureUrl) {
        throw new Error('No URL returned from upload');
      }
      
      return secureUrl;
      
    } catch (error: any) {
      console.error('Failed to upload media:', error);
      setUploadError(error.message || 'Failed to upload media. Please try again.');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

const handleSend = async () => {
  if (hasMedia && !mediaFile) {
    setUploadError("Please select a media file for the header");
    return;
  }

  // Start sending state
  setIsSending(true);
  setUploadError(null);

  let mediaUrl: string | undefined;
  
  // Handle media upload if needed
  if (hasMedia && mediaFile) {
    try {
      mediaUrl = await uploadMediaToCloudinary(mediaFile);
    } catch (error) {
      setIsSending(false);
      return;
    }
  }

  // Build variables object with priority: variable > value > fallback
  const variableValues: Record<string, string> = {};
  variables.forEach(v => {
    variableValues[v.name] = v.variable.trim() || v.value.trim() || v.fallback;
  });

  try {
    // Call the onSend callback with variables and media
    await onSend(variableValues, mediaUrl ? { 
      type: headerComponent?.format?.toLowerCase() || 'image', 
      url: mediaUrl 
    } : undefined);
    
    // Cleanup on success
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    
    setMediaFile(null);
    setMediaPreview(null);
    setUploadError(null);
    setIsUploading(false);
    setIsSending(false);
    
    onOpenChange(false);
    
  } catch (error: any) {
    // Handle send error
    console.error('Failed to send template:', error);
    setUploadError(error.message || 'Failed to send template message. Please try again.');
    setIsSending(false);
  }
};

  const getMediaIcon = () => {
    if (!headerComponent) return null;
    switch (headerComponent.format) {
      case 'IMAGE': return <ImageIcon className="w-10 h-10 text-muted-foreground" />;
      case 'VIDEO': return <Video className="w-10 h-10 text-muted-foreground" />;
      case 'DOCUMENT': return <File className="w-10 h-10 text-muted-foreground" />;
      default: return null;
    }
  };

  const needsInput = variables.length > 0 || hasMedia;

  // Get preview text with variables replaced
  const getPreviewBody = () => {
    if (!bodyComponent?.text) return '';
    let text = bodyComponent.text;
    
    // First, replace numbered parameters like {{1}}, {{2}}, etc.
    for (let i = 0; i <= 10; i++) {
      const placeholder = `{{${i}}}`;
      const variable = variables.find(v => v.name === i.toString());
      if (variable) {
        const displayValue = variable.variable.trim() || variable.value.trim() || variable.fallback || `{{${variable.name}}}`;
        text = text.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), displayValue);
      }
    }
    
    // Then replace named parameters
    variables.forEach(v => {
      // Skip numbered parameters we already handled
      if (/^\d+$/.test(v.name)) return;
      
      const displayValue = v.variable.trim() || v.value.trim() || v.fallback || `{{${v.name}}}`;
      const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
      text = text.replace(regex, displayValue);
    });
    
    return text;
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (!newOpen && mediaPreview) {
          URL.revokeObjectURL(mediaPreview);
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            Send Template: {template.name.replace(/_/g, " ")}
          </DialogTitle>
        </DialogHeader>

        {/* MAIN CONTENT AREA WITH SCROLLING - USING SIMPLE DIV INSTEAD OF SCROLLAREA */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div 
                ref={scrollContainerRef}
                className="space-y-6"
              >
                {/* Media Input */}
                {hasMedia && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      {headerComponent.format === 'IMAGE' && "Header Image"}
                      {headerComponent.format === 'VIDEO' && "Header Video"}
                      {headerComponent.format === 'DOCUMENT' && "Header Document"}
                      <span className="text-xs text-muted-foreground ml-2">
                        (Max 5MB, will be uploaded to Cloudinary)
                      </span>
                    </Label>
                    
                    {uploadError && (
                      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                        {uploadError}
                      </div>
                    )}
                    
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        id="media-upload"
                        accept={getMediaAccept(headerComponent.format)}
                        className="hidden"
                        onChange={handleMediaSelect}
                        disabled={isUploading}
                      />
                      <label htmlFor="media-upload" className="cursor-pointer block">
                        {isUploading ? (
                          <div className="space-y-2">
                            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
                            <p className="text-sm text-muted-foreground">
                              Uploading to Cloudinary...
                            </p>
                          </div>
                        ) : mediaPreview ? (
                          <div className="space-y-3">
                            {headerComponent.format === 'IMAGE' && (
                              <img
                                src={mediaPreview}
                                alt="Selected"
                                className="max-h-32 mx-auto rounded-lg object-contain"
                              />
                            )}
                            {headerComponent.format === 'VIDEO' && (
                              <div className="flex items-center justify-center gap-2 text-primary">
                                <Video className="w-8 h-8" />
                                <span className="text-sm">{mediaFile?.name}</span>
                              </div>
                            )}
                            {headerComponent.format === 'DOCUMENT' && (
                              <div className="flex items-center justify-center gap-2 text-primary">
                                <File className="w-8 h-8" />
                                <span className="text-sm">{mediaFile?.name}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  document.getElementById('media-upload')?.click();
                                }}
                                disabled={isUploading}
                              >
                                Change File
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRemoveMedia();
                                }}
                                disabled={isUploading}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                            {mediaFile && (
                              <p className="text-xs text-muted-foreground">
                                Size: {(mediaFile.size / 1024 / 1024).toFixed(2)} MB • 
                                Type: {mediaFile.type || 'Unknown'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {getMediaIcon()}
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                Upload {headerComponent.format.toLowerCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getFileTypeDescription(headerComponent.format)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Click to select a file (Max 5MB)
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                document.getElementById('media-upload')?.click();
                              }}
                              disabled={isUploading}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Select File
                            </Button>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* Variables Input */}
                {variables.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Template Variables ({variables.length})
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Type <code className="px-1 py-0.5 bg-muted rounded">$</code> to insert a variable
                      </span>
                    </div>
                    {variables.map((variable, index) => {
                      const hasSystemVariable = variable.variable.trim() !== '';
                      
                      return (
                        <div
                          key={variable.name}
                          ref={(el) => {
                            variableRefs.current[index] = el;
                          }}
                          className={`p-4 rounded-xl space-y-3 transition-all duration-200 ${
                            activeVariableIndex === index
                              ? 'bg-primary/5 border border-primary/20 shadow-sm'
                              : 'bg-secondary/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary rounded">
                                {`{{${variable.name}}}`}
                              </span>
                              {hasSystemVariable && (
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  System Variable
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {index + 1}/{variables.length}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {/* Variable Field */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  Variable (Type $ to insert)
                                </Label>
                                {variable.variable.trim() && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-xs"
                                    onClick={() => handleClearVariable(variable.name)}
                                    disabled={isUploading}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                              <VariableDropdown
                                value={variable.variable}
                                onChange={(val) => handleVariableFieldChange(variable.name, val)}
                                onVariableSelected={() => handleVariableSelected(variable.name, index)}
                                placeholder="Type $ to insert system variable"
                                disabled={isUploading}
                              />
                              {variable.variable.trim() && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Using system variable: {variable.variable}
                                </p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {/* Value Field - DISABLED when system variable is selected */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs text-muted-foreground">
                                    Value
                                  </Label>
                                  {hasSystemVariable && (
                                    <span className="text-xs text-muted-foreground italic">
                                      (disabled - using system variable)
                                    </span>
                                  )}
                                </div>
                                <div className="relative">
                                  <Input
                                    placeholder="Enter value"
                                    value={variable.value}
                                    onChange={(e) => handleValueChange(variable.name, e.target.value)}
                                    className="text-sm"
                                    disabled={hasSystemVariable || isUploading}
                                  />
                                  {hasSystemVariable && (
                                    <div className="absolute inset-0 bg-background/50 rounded-md flex items-center justify-center">
                                      <Lock className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Fallback Field */}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Fallback
                                </Label>
                                <Input
                                  placeholder="Fallback value"
                                  value={variable.fallback}
                                  onChange={(e) => handleFallbackChange(variable.name, e.target.value)}
                                  className="text-sm bg-muted"
                                  disabled={isUploading}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!needsInput && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>This template has no variables or media to configure.</p>
                    <p className="text-sm mt-1">Click send to proceed.</p>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              <div className="lg:border-l lg:border-border lg:pl-6">
                <Label className="text-sm font-medium block mb-3">Template Preview</Label>
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-4">
                    {/* Template Info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Template:</span> {template.name}
                      </div>
                      <div>
                        <span className="font-medium">Language:</span> {template.language}
                      </div>
                    </div>

                    {/* Header Preview */}
                    {hasMedia && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">HEADER</p>
                        {mediaPreview ? (
                          headerComponent.format === 'IMAGE' ? (
                            <div className="border border-border rounded-lg overflow-hidden">
                              <img
                                src={mediaPreview}
                                alt="Header preview"
                                className="w-full h-40 object-contain bg-black"
                              />
                            </div>
                          ) : (
                            <div className="border border-border rounded-lg p-3 bg-background">
                              <div className="flex items-center gap-2">
                                {headerComponent.format === 'VIDEO' && <Video className="w-4 h-4" />}
                                {headerComponent.format === 'DOCUMENT' && <File className="w-4 h-4" />}
                                <span className="text-sm font-medium">
                                  {mediaFile?.name || 'Media File'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {headerComponent.format} will be sent
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="border border-border border-dashed rounded-lg p-4 text-center">
                            <p className="text-sm text-muted-foreground">
                              Select a {headerComponent.format?.toLowerCase()} file to preview
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body Preview */}
                    {bodyComponent && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">BODY</p>
                        <div className="bg-background border border-border rounded-lg p-4 min-h-32">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {getPreviewBody()}
                          </p>
                          {variables.length > 0 && getPreviewBody().includes('{{') && (
                            <p className="text-xs text-destructive mt-2">
                              ⚠️ Some variables are still not filled
                            </p>
                          )}
                        </div>
                        
                        {/* Show variables status */}
                        {variables.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Variables Status:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {variables.map((v, index) => {
                                const isFilled = v.variable.trim() || v.value.trim();
                                const isSystemVariable = v.variable.trim() !== '';
                                return (
                                  <div
                                    key={index}
                                    className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 ${
                                      isSystemVariable
                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                        : isFilled
                                        ? 'bg-green-100 text-green-800 border border-green-200'
                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                    }`}
                                  >
                                    {v.name}: 
                                    {isSystemVariable && <Lock className="w-3 h-3" />}
                                    {isFilled ? '✓' : '✗'}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Preview */}
                    {footerComponent?.text && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">FOOTER</p>
                        <div className="bg-background border border-border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {footerComponent.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Buttons Preview */}
                    {template.components?.find((c: any) => c.type === 'BUTTONS') && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">BUTTONS</p>
                        <div className="space-y-2">
                          {template.components
                            ?.find((c: any) => c.type === 'BUTTONS')
                            ?.buttons?.map((button: any, index: number) => (
                              <div
                                key={index}
                                className="bg-background border border-border rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{button.text}</span>
                                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                                    {button.type}
                                  </span>
                                </div>
                                {button.url && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    URL: {button.url}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

<DialogFooter className="px-6 py-4 border-t border-border mt-auto">
  <Button 
    variant="outline" 
    onClick={() => onOpenChange(false)}
    disabled={isUploading || isSending}
  >
    Cancel
  </Button>
  <Button 
    onClick={handleSend}
    disabled={isUploading || isSending || (hasMedia && !mediaFile)}
    className="gap-2 min-w-24"
  >
    {isSending ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Sending...
      </>
    ) : isUploading ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Uploading...
      </>
    ) : (
      <>
        <Send className="w-4 h-4" />
        Send Template
      </>
    )}
  </Button>
</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}