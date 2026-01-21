// frontend/src/pages/CreateBroadcastPage.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  UsersIcon,
  TagIcon,
  UserIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  VideoCameraIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import hooks and store
import {
  useBroadcastStore,
  useCreateBroadcast,
  useBroadcast,
} from '@/lib/api/broadcasts';
import { useApprovedTemplates, type Template } from '@/lib/api/templates';
import { useContacts, type Contact } from '@/lib/api/contacts';
import { useTags, type Tag } from '@/lib/api/tags';
import { mediaApi } from '@/lib/api/media';
import { useAuthStore } from '@/stores/auth.store';

const steps = [
  { id: 1, name: 'Audience', description: 'Select recipients' },
  { id: 2, name: 'Template', description: 'Choose message' },
  { id: 3, name: 'Content', description: 'Customize variables' },
  { id: 4, name: 'Schedule', description: 'When to send' },
  { id: 5, name: 'Review', description: 'Confirm & send' },
];

// Available system variables for broadcast
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
  example?: string;
}

// VariableDropdown component for broadcast (same as in TemplateVariablesDialog)
function VariableDropdown({ 
  value, 
  onChange, 
  placeholder, 
  disabled,
  onVariableSelected 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
  disabled?: boolean;
  onVariableSelected?: () => void;
}) {
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

export default function CreateBroadcast() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const { user } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [broadcastVariables, setBroadcastVariables] = useState<VariableInput[]>([]);
  
  // React Query hooks
  const { data: templates, isLoading: templatesLoading } = useApprovedTemplates();
  const { data: tags, isLoading: tagsLoading } = useTags();
  
  // Use contacts API with search
  const { data: contactsData, isLoading: contactsLoading, error: contactsError } = useContacts({
    search: contactSearchTerm || undefined,
    limit: 100,
    page: 1,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  
  // Fetch broadcast to duplicate if duplicateId is present
  const { data: broadcastToDuplicate } = useBroadcast(duplicateId || '', {
    enabled: !!duplicateId,
  });
  
  // Zustand store
  const {
    selectedAudience,
    selectedTemplateId,
    variables,
    mediaUrl,
    scheduleType,
    scheduledDate,
    scheduledTime,
    name,
    setSelectedAudience,
    setSelectedTemplateId,
    setVariable,
    setVariables,
    setMediaUrl,
    setSchedule,
    setName,
    resetForm,
    loadFromBroadcast,
  } = useBroadcastStore();
  
  // Mutation
  const createBroadcastMutation = useCreateBroadcast();
  
  // Debug templates loading
  useEffect(() => {
    console.log('Templates data:', {
      hasData: !!templates,
      data: templates,
      templatesCount: templates?.length || 0,
      selectedTemplateId,
    });
  }, [templates, selectedTemplateId]);
  
  // Load broadcast data for duplication
  useEffect(() => {
    if (duplicateId && broadcastToDuplicate?.broadcast) {
      loadFromBroadcast(broadcastToDuplicate.broadcast);
      toast.success('Broadcast loaded for duplication');
    }
  }, [duplicateId, broadcastToDuplicate, loadFromBroadcast]);
  
  // Debounce contact search
  useEffect(() => {
    const timer = setTimeout(() => {
      setContactSearchTerm(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Get selected template
  const selectedTemplate = useMemo(() => {
    return templates?.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);
  
  // Extract variables from template - FIXED to include fallback and examples
  useEffect(() => {
    if (!selectedTemplate) {
      setBroadcastVariables([]);
      return;
    }
    
    const bodyComponent = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
    const newVariables: VariableInput[] = [];
    
    console.log('Extracting variables from template:', {
      templateName: selectedTemplate.name,
      bodyText: bodyComponent?.text,
      exampleData: bodyComponent?.example
    });
    
    // 1. FIRST: Check for structured named parameters
    if (bodyComponent?.example?.body_text_named_params) {
      console.log('Found body_text_named_params:', bodyComponent.example.body_text_named_params);
      bodyComponent.example.body_text_named_params.forEach((param: any) => {
        newVariables.push({
          name: param.param_name,
          variable: '',
          value: variables[param.param_name] || '',
          fallback: param.example || '',
          example: param.example
        });
      });
    }
    // 2. SECOND: Check for numbered parameters in example array (0-indexed from API)
    else if (bodyComponent?.example?.body_text) {
      console.log('Found body_text array:', bodyComponent.example.body_text);
      const positionGroups = bodyComponent.example.body_text;
      if (positionGroups && positionGroups.length > 0) {
        const exampleGroup = positionGroups[0];
        exampleGroup.forEach((example: string, index: number) => {
          // Use the 0-indexed name from the template
          const variableName = index.toString();
          newVariables.push({
            name: variableName,
            variable: '',
            value: variables[variableName] || '',
            fallback: example || '',
            example: example
          });
        });
      }
    }
    // 3. THIRD: Fallback to regex extraction from text
    else if (bodyComponent?.text) {
      console.log('Falling back to regex extraction from text:', bodyComponent.text);
      const bodyText = bodyComponent.text;
      
      const pattern = /\{\{\s*([^}]+)\s*\}\}/g;
      const matches = bodyText.match(pattern) || [];
      const uniqueMatches = [...new Set(matches)];
      
      console.log('Regex matches found:', uniqueMatches);
      
      uniqueMatches.forEach((match, index) => {
        const name = match.replace(/[{}]/g, '').trim();
        newVariables.push({
          name,
          variable: '',
          value: variables[name] || '',
          fallback: '',
          example: `Example for ${name}`
        });
      });
    }
    
    // 4. Apply existing variables from store
    const updatedVariables = newVariables.map(v => ({
      ...v,
      value: variables[v.name] || v.value
    }));
    
    console.log('Setting broadcast variables:', updatedVariables);
    setBroadcastVariables(updatedVariables);
    
    // Cleanup media preview when template changes
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    }
    setMediaFile(null);
    setMediaUrl(''); // Reset media URL when template changes
    
  }, [selectedTemplate, variables]);
  
  // Get media format from template header
  const hasMediaHeader = useMemo(() => {
    if (!selectedTemplate) return false;
    return selectedTemplate.components?.some(
      (c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format || '')
    );
  }, [selectedTemplate]);
  
  const headerFormat = useMemo(() => {
    if (!selectedTemplate) return null;
    const headerComponent = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
    return headerComponent?.format || null;
  }, [selectedTemplate]);
  
  // Get contacts from the response
  const contacts = contactsData?.contacts || [];
  const totalContacts = contactsData?.pagination?.total || 0;
  
  // Calculate audience size
  const audienceSize = (() => {
    switch (selectedAudience.type) {
      case 'all':
        return contacts.length;
      case 'tags':
        if (!tags || selectedAudience.tags.length === 0) return 0;
        let total = 0;
        selectedAudience.tags.forEach(tagId => {
          const tag = tags.find((t: Tag) => t.id === tagId);
          if (tag?.contactCount) {
            total += tag.contactCount;
          }
        });
        return total;
      case 'contacts':
        return selectedAudience.contacts.length;
      default:
        return 0;
    }
  })();
  
  // Filter templates for search
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    
    return templates.filter(
      (t: Template) =>
        t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.category?.toLowerCase().includes(templateSearch.toLowerCase())
    );
  }, [templates, templateSearch]);
  
  const handleTagToggle = (tagId: string) => {
    const newTags = selectedAudience.tags.includes(tagId)
      ? selectedAudience.tags.filter((id) => id !== tagId)
      : [...selectedAudience.tags, tagId];
    
    setSelectedAudience({ tags: newTags });
  };
  
  const handleContactToggle = (contactId: string) => {
    const newContacts = selectedAudience.contacts.includes(contactId)
      ? selectedAudience.contacts.filter((id) => id !== contactId)
      : [...selectedAudience.contacts, contactId];
    
    setSelectedAudience({ contacts: newContacts });
  };
  
  const handleSelectAllContacts = () => {
    const allContactIds = contacts.map((contact: Contact) => contact.id);
    const newContacts = selectedAudience.contacts.length === allContactIds.length 
      ? [] 
      : allContactIds;
    
    setSelectedAudience({ contacts: newContacts });
  };
  
  // Handle variable changes with fallback support
  const handleVariableChange = (variableName: string, field: 'variable' | 'value' | 'fallback', value: string) => {
    setBroadcastVariables(prev =>
      prev.map(v => (v.name === variableName ? { ...v, [field]: value } : v))
    );
    
    // Also update the store variables for the value field
    if (field === 'value') {
      setVariable(variableName, value);
    }
  };
  
  // Clear system variable
  const handleClearVariable = (variableName: string) => {
    setBroadcastVariables(prev =>
      prev.map(v => (v.name === variableName ? { ...v, variable: '', value: '' } : v))
    );
    setVariable(variableName, '');
  };
  
  // Get media accept string based on format
  const getMediaAccept = (format?: string): string => {
    if (!format) return '';
    switch (format) {
      case 'IMAGE': return 'image/*';
      case 'VIDEO': return 'video/*';
      case 'DOCUMENT': return '.pdf,.doc,.docx,.txt,.zip,.rar';
      default: return '';
    }
  };
  
  // Get file type description
  const getFileTypeDescription = (format?: string): string => {
    if (!format) return '';
    switch (format) {
      case 'IMAGE': return 'Images (.jpg, .png, .gif, .webp)';
      case 'VIDEO': return 'Videos (.mp4, .avi, .mov, .webm)';
      case 'DOCUMENT': return 'Documents (.pdf, .doc, .docx, .txt)';
      default: return 'Any file';
    }
  };
  
  // Check if file type is valid
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
  
  // Handle media file selection
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setUploadError(`File too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      
      if (headerFormat) {
        if (!isValidFileType(file, headerFormat)) {
          setUploadError(`Invalid file type. Please select a ${getFileTypeDescription(headerFormat)} file.`);
          return;
        }
      }
      
      setMediaFile(file);
      setUploadError(null);
      
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
      // Don't set mediaUrl in store yet - we'll upload to Cloudinary first
    }
  };
  
  const handleRemoveMedia = () => {
    setMediaFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    setMediaUrl('');
    setUploadError(null);
  };
  
  // Upload media to Cloudinary (like in TemplateVariablesDialog)
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
  
  // Get media icon based on format
  const getMediaIcon = () => {
    if (!headerFormat) return null;
    switch (headerFormat) {
      case 'IMAGE': return <PhotoIcon className="w-10 h-10 text-muted-foreground mx-auto" />;
      case 'VIDEO': return <VideoCameraIcon className="w-10 h-10 text-muted-foreground mx-auto" />;
      case 'DOCUMENT': return <DocumentIcon className="w-10 h-10 text-muted-foreground mx-auto" />;
      default: return null;
    }
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (selectedAudience.type === 'all') return true;
        if (selectedAudience.type === 'tags') return selectedAudience.tags.length > 0;
        if (selectedAudience.type === 'contacts') return selectedAudience.contacts.length > 0;
        return false;
      case 2:
        return !!selectedTemplateId;
      case 3:
        // Validate all variables are filled (either value or fallback)
        const allVariablesFilled = broadcastVariables.every((v) => {
          const finalValue = v.variable.trim() || v.value.trim() || v.fallback.trim();
          return finalValue.length > 0;
        });
        
        // Validate media if required - mediaUrl should be set after Cloudinary upload
        const mediaFilled = !hasMediaHeader || mediaUrl.trim();
        
        console.log('Validation check:', {
          allVariablesFilled,
          mediaFilled,
          variablesCount: broadcastVariables.length,
          hasMediaHeader,
          mediaUrl
        });
        
        return allVariablesFilled && mediaFilled;
      case 4:
        if (scheduleType === 'now') return true;
        return scheduledDate && scheduledTime;
      case 5:
        return name.trim().length > 0;
      default:
        return false;
    }
  };
  
  const handleNext = () => {
    if (currentStep < 5) {
      // If moving to step 3 and we have media, upload it first
      if (currentStep === 2 && hasMediaHeader && mediaFile && !mediaUrl) {
        // Auto-upload media when moving to next step
        handleUploadMedia();
        return; // Don't proceed until upload is complete
      }
      
      setCurrentStep(currentStep + 1);
    }
  };
  
  // Handle media upload separately
  const handleUploadMedia = async () => {
    if (!mediaFile) return;
    
    try {
      const cloudinaryUrl = await uploadMediaToCloudinary(mediaFile);
      setMediaUrl(cloudinaryUrl); // Store the Cloudinary URL
      toast.success('Media uploaded to Cloudinary successfully');
      
      // Now proceed to next step
      setCurrentStep(3);
    } catch (error) {
      // Error is already shown by uploadMediaToCloudinary
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Prepare variables object - use variable field first, then value, then fallback
      const finalVariables: Record<string, string> = {};
      broadcastVariables.forEach(v => {
        finalVariables[v.name] = v.variable.trim() || v.value.trim() || v.fallback.trim();
      });
      
      // Prepare the request body
      const requestBody = {
        name,
        templateId: selectedTemplateId,
        audienceType: selectedAudience.type,
        audienceFilter: {
          tags: selectedAudience.type === 'tags' ? selectedAudience.tags : undefined,
          contacts: selectedAudience.type === 'contacts' ? selectedAudience.contacts : undefined,
        },
        variables: finalVariables,
        mediaUrl, // This should be the Cloudinary URL
        scheduleType,
        scheduledDate: scheduleType === 'scheduled' ? scheduledDate : undefined,
        scheduledTime: scheduleType === 'scheduled' ? scheduledTime : undefined,
      };
      
      console.log('Sending broadcast request:', requestBody);
      
      await createBroadcastMutation.mutateAsync(requestBody);
      
      toast.success(
        scheduleType === 'now'
          ? 'Broadcast is being sent!'
          : `Broadcast scheduled for ${scheduledDate} at ${scheduledTime}`
      );
      
      // Reset form and navigate
      resetForm();
      navigate('/broadcasts');
      
    } catch (error: any) {
      console.error('Error creating broadcast:', error);
      toast.error(error.response?.data?.error || 'Failed to create broadcast');
    } finally {
      setLoading(false);
    }
  };
  
  // Get body text for preview
  const bodyComponent = selectedTemplate?.components?.find((c: any) => c.type === 'BODY');
  const bodyText = bodyComponent?.text || '';
  
  // Replace variables in body text for preview with proper handling
  const previewBody = useMemo(() => {
    if (!bodyText) return '';
    
    let text = bodyText;
    
    // Replace variables in the text
    broadcastVariables.forEach(v => {
      const displayValue = v.variable.trim() || v.value.trim() || v.fallback.trim() || `{{${v.name}}}`;
      const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
      text = text.replace(regex, displayValue);
    });
    
    return text;
  }, [bodyText, broadcastVariables]);
  
  // Cleanup media preview on unmount
  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/broadcasts')}>
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {duplicateId ? 'Duplicate Broadcast' : 'Create Broadcast'}
          </h1>
          <p className="text-muted-foreground">Send WhatsApp messages to multiple contacts</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    currentStep > step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {currentStep > step.id ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4 mt-[-20px]',
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 card-gradient rounded-xl p-6">
          {/* Step 1: Audience Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Select Your Audience
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose who will receive this broadcast message
                </p>
              </div>

              <RadioGroup
                value={selectedAudience.type}
                onValueChange={(value: 'all' | 'tags' | 'contacts') =>
                  setSelectedAudience({ type: value })
                }
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="all"
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                    selectedAudience.type === 'all'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value="all" id="all" />
                  <UsersIcon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">All Contacts</p>
                    <p className="text-xs text-muted-foreground">
                      {contacts.length} contacts
                    </p>
                  </div>
                </Label>

                <Label
                  htmlFor="tags"
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                    selectedAudience.type === 'tags'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value="tags" id="tags" />
                  <TagIcon className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-foreground">By Tags</p>
                    <p className="text-xs text-muted-foreground">Filter by contact tags</p>
                  </div>
                </Label>

                <Label
                  htmlFor="contacts"
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                    selectedAudience.type === 'contacts'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value="contacts" id="contacts" />
                  <UserIcon className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-foreground">Individual Contacts</p>
                    <p className="text-xs text-muted-foreground">Select specific contacts</p>
                  </div>
                </Label>
              </RadioGroup>

              {/* Tags Selection */}
              {selectedAudience.type === 'tags' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select Tags</Label>
                  {tagsLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                      ))}
                    </div>
                  ) : !tags || tags.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-lg">
                      <TagIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No tags created yet</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => navigate('/tags')}
                      >
                        Go to Tags
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {tags.map((tag: Tag) => (
                        <div
                          key={tag.id}
                          onClick={() => handleTagToggle(tag.id)}
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                            selectedAudience.tags.includes(tag.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Checkbox checked={selectedAudience.tags.includes(tag.id)} />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {tag.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tag.contactCount || 0} contacts
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Individual Contacts Selection */}
              {selectedAudience.type === 'contacts' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Select Contacts</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSelectAllContacts}
                      disabled={contactsLoading || contacts.length === 0}
                    >
                      {selectedAudience.contacts.length === contacts.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                  </div>
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts by name, phone, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contactsLoading ? 'Loading contacts...' : 
                     contacts.length === 0 ? 'No contacts found' :
                     `Showing ${contacts.length} of ${totalContacts} total contacts`}
                  </div>
                  
                  {contactsError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">
                        Error loading contacts: {contactsError.message}
                      </p>
                    </div>
                  )}
                  
                  <ScrollArea className="h-64 rounded-lg border border-border">
                    {contactsLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 rounded-lg" />
                        ))}
                      </div>
                    ) : contacts.length === 0 ? (
                      <div className="p-8 text-center">
                        <UserIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {contactSearchTerm 
                            ? 'No contacts found matching your search'
                            : 'No contacts available'
                          }
                        </p>
                        {!contactSearchTerm && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3"
                            onClick={() => navigate('/contacts')}
                          >
                            Go to Contacts
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {contacts.map((contact: Contact) => (
                          <div
                            key={contact.id}
                            onClick={() => handleContactToggle(contact.id)}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                              selectedAudience.contacts.includes(contact.id)
                                ? 'bg-primary/10 border border-primary/20'
                                : 'hover:bg-muted border border-transparent hover:border-border'
                            )}
                          >
                            <Checkbox 
                              checked={selectedAudience.contacts.includes(contact.id)} 
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => handleContactToggle(contact.id)}
                            />
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {contact.name
                                  ?.split(' ')
                                  .map((n) => n[0])
                                  .join('') 
                                  || contact.email?.charAt(0).toUpperCase() 
                                  || contact.phone?.slice(-2)
                                  || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {contact.name || 'Unnamed Contact'}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">{contact.phone}</p>
                                {contact.email && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                      {contact.email}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {contact.tags?.slice(0, 2).map((tag: any) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    borderColor: `${tag.color}40`
                                  }}
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                              {contact.tags && contact.tags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{contact.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Template Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Choose a Template
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select an approved WhatsApp message template
                </p>
              </div>

              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Tabs defaultValue="all" className="w-full">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing</TabsTrigger>
                  <TabsTrigger value="utility">Utility</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {templatesLoading ? (
                        // Loading skeletons
                        [...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-32 rounded-lg" />
                        ))
                      ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-8">
                          <DocumentIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">
                            {templateSearch ? 'No templates found matching your search' : 'No approved templates available'}
                          </p>
                        </div>
                      ) : (
                        filteredTemplates.map((template: Template) => (
                          <TemplateItem
                            key={template.id}
                            template={template}
                            selected={selectedTemplateId === template.id}
                            onSelect={() => setSelectedTemplateId(template.id)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {['marketing', 'utility'].map((category) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-4">
                        {templatesLoading ? (
                          [...Array(2)].map((_, i) => (
                            <Skeleton key={i} className="h-32 rounded-lg" />
                          ))
                        ) : filteredTemplates
                            .filter((t: Template) => t.category === category.toUpperCase())
                            .map((template: Template) => (
                              <TemplateItem
                                key={template.id}
                                template={template}
                                selected={selectedTemplateId === template.id}
                                onSelect={() => setSelectedTemplateId(template.id)}
                              />
                            ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* Step 3: Content/Variables - UPDATED with proper Cloudinary upload */}
          {currentStep === 3 && selectedTemplate && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Customize Content
                </h2>
                <p className="text-sm text-muted-foreground">
                  Fill in the template variables and upload media if required
                </p>
                
                {/* Validation status */}
                <div className={`p-3 rounded-lg mt-2 ${canProceed() ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {canProceed() ? (
                      <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className={canProceed() ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                      {canProceed() 
                        ? 'All required fields are filled'
                        : 'Please fill all required fields'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Media Upload - UPDATED with Cloudinary upload */}
              {hasMediaHeader && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {headerFormat === 'IMAGE' && <PhotoIcon className="w-4 h-4" />}
                    {headerFormat === 'VIDEO' && <VideoCameraIcon className="w-4 h-4" />}
                    {headerFormat === 'DOCUMENT' && <DocumentIcon className="w-4 h-4" />}
                    {headerFormat?.charAt(0).toUpperCase() + headerFormat?.slice(1).toLowerCase()} Upload
                    <span className="text-destructive">*</span>
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
                      accept={getMediaAccept(headerFormat)}
                      className="hidden"
                      onChange={handleMediaSelect}
                      disabled={isUploading || !!mediaUrl}
                    />
                    <label htmlFor="media-upload" className="cursor-pointer block">
                      {isUploading ? (
                        <div className="space-y-2">
                          <ArrowPathIcon className="w-10 h-10 text-primary mx-auto animate-spin" />
                          <p className="text-sm text-muted-foreground">
                            Uploading to Cloudinary...
                          </p>
                        </div>
                      ) : mediaPreview && mediaUrl ? (
                        <div className="space-y-3">
                          {headerFormat === 'IMAGE' && (
                            <img
                              src={mediaPreview}
                              alt="Selected"
                              className="max-h-32 mx-auto rounded-lg object-contain"
                            />
                          )}
                          {headerFormat === 'VIDEO' && (
                            <div className="flex items-center justify-center gap-2 text-primary">
                              <VideoCameraIcon className="w-8 h-8" />
                              <span className="text-sm">{mediaFile?.name}</span>
                            </div>
                          )}
                          {headerFormat === 'DOCUMENT' && (
                            <div className="flex items-center justify-center gap-2 text-primary">
                              <DocumentIcon className="w-8 h-8" />
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
                              <XMarkIcon className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                          {mediaFile && (
                            <p className="text-xs text-muted-foreground">
                              Size: {(mediaFile.size / 1024 / 1024).toFixed(2)} MB • 
                              Type: {mediaFile.type || 'Unknown'}
                            </p>
                          )}
                          <div className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
                            ✓ Uploaded to Cloudinary
                          </div>
                        </div>
                      ) : mediaPreview && !mediaUrl ? (
                        <div className="space-y-3">
                          {headerFormat === 'IMAGE' && (
                            <img
                              src={mediaPreview}
                              alt="Selected"
                              className="max-h-32 mx-auto rounded-lg object-contain"
                            />
                          )}
                          {headerFormat === 'VIDEO' && (
                            <div className="flex items-center justify-center gap-2 text-primary">
                              <VideoCameraIcon className="w-8 h-8" />
                              <span className="text-sm">{mediaFile?.name}</span>
                            </div>
                          )}
                          {headerFormat === 'DOCUMENT' && (
                            <div className="flex items-center justify-center gap-2 text-primary">
                              <DocumentIcon className="w-8 h-8" />
                              <span className="text-sm">{mediaFile?.name}</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={handleUploadMedia}
                              disabled={isUploading}
                              className="gap-2"
                            >
                              {isUploading ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <ArrowPathIcon className="w-4 h-4" />
                                  Upload to Cloudinary
                                </>
                              )}
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
                              <XMarkIcon className="w-4 h-4 mr-1" />
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
                              Upload {headerFormat?.toLowerCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getFileTypeDescription(headerFormat)}
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
                            Select File
                          </Button>
                        </div>
                      )}
                    </label>
                  </div>
                  
                  {/* Alternative URL input (for already uploaded media) */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Or enter a URL (already uploaded to Cloudinary):
                    </Label>
                    <Input
                      placeholder={`Enter ${headerFormat?.toLowerCase()} Cloudinary URL...`}
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      disabled={!!mediaFile}
                    />
                  </div>
                </div>
              )}

              {/* Variables - UPDATED with fallback and variable picker */}
              {broadcastVariables.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Template Variables ({broadcastVariables.length})
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Type <code className="px-1 py-0.5 bg-muted rounded">$</code> to insert a system variable
                    </span>
                  </div>
                  <div className="space-y-3">
                    {broadcastVariables.map((variable, index) => {
                      const hasSystemVariable = variable.variable.trim() !== '';
                      
                      return (
                        <div
                          key={variable.name}
                          className={`p-4 rounded-xl space-y-3 transition-all duration-200 border ${
                            hasSystemVariable
                              ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                              : 'bg-secondary/50 border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary rounded">
                                {`{{${variable.name}}}`}
                              </span>
                              {hasSystemVariable && (
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded flex items-center gap-1">
                                  <LockClosedIcon className="w-3 h-3" />
                                  System Variable
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {index + 1}/{broadcastVariables.length}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {/* Variable Field */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  Variable (Type $ to insert system variable)
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
                                onChange={(val) => handleVariableChange(variable.name, 'variable', val)}
                                placeholder="Type $ to insert system variable"
                                disabled={isUploading}
                              />
                              {variable.variable.trim() && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                  <LockClosedIcon className="w-3 h-3" />
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
                                    onChange={(e) => handleVariableChange(variable.name, 'value', e.target.value)}
                                    className="text-sm"
                                    disabled={hasSystemVariable || isUploading}
                                  />
                                  {hasSystemVariable && (
                                    <div className="absolute inset-0 bg-background/50 rounded-md flex items-center justify-center">
                                      <LockClosedIcon className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Fallback Field */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs text-muted-foreground">
                                    Fallback
                                  </Label>
                                  {variable.example && (
                                    <span className="text-xs text-muted-foreground">
                                      e.g., {variable.example}
                                    </span>
                                  )}
                                </div>
                                <Input
                                  placeholder="Fallback value"
                                  value={variable.fallback}
                                  onChange={(e) => handleVariableChange(variable.name, 'fallback', e.target.value)}
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
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    This template has no variables to customize
                  </p>
                </div>
              )}

              {/* Validation summary */}
              {broadcastVariables.length > 0 && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Validation Status</span>
                    <Badge variant={canProceed() ? "default" : "destructive"}>
                      {canProceed() ? "Ready" : "Incomplete"}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {broadcastVariables.map((v, index) => {
                      const isFilled = v.variable.trim() || v.value.trim() || v.fallback.trim();
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${isFilled ? 'bg-green-500' : 'bg-amber-500'}`} />
                          <span className={`${isFilled ? 'text-green-600' : 'text-amber-600'}`}>
                            {`{{${v.name}}}`}: {isFilled ? 'Filled' : 'Required'}
                          </span>
                        </div>
                      );
                    })}
                    {hasMediaHeader && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full ${mediaUrl.trim() ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span className={mediaUrl.trim() ? 'text-green-600' : 'text-amber-600'}>
                          Media: {mediaUrl.trim() ? 'Uploaded' : 'Required'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Schedule */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Schedule Broadcast
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose when to send this broadcast
                </p>
              </div>

              <RadioGroup
                value={scheduleType}
                onValueChange={(value: 'now' | 'scheduled') => setSchedule({ type: value })}
                className="space-y-4"
              >
                <Label
                  htmlFor="now"
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                    scheduleType === 'now'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value="now" id="now" />
                  <PaperAirplaneIcon className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Send Now</p>
                    <p className="text-sm text-muted-foreground">
                      Start sending immediately after review
                    </p>
                  </div>
                </Label>

                <Label
                  htmlFor="scheduled"
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                    scheduleType === 'scheduled'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <CalendarIcon className="w-6 h-6 text-blue-500" />
                  <div>
                    <p className="font-medium text-foreground">Schedule for Later</p>
                    <p className="text-sm text-muted-foreground">
                      Set a specific date and time
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              {scheduleType === 'scheduled' && (
                <div className="grid grid-cols-2 gap-4 pl-10">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setSchedule({ date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setSchedule({ time: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Timezone Note */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="w-4 h-4" />
                <span>Times are in your local timezone</span>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Review & Confirm
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review your broadcast details before sending
                </p>
              </div>

              {/* Broadcast Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Broadcast Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter a name for this broadcast..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Audience</p>
                    <p className="font-medium text-foreground mt-1">
                      {selectedAudience.type === 'all' && 'All Contacts'}
                      {selectedAudience.type === 'tags' &&
                        `${selectedAudience.tags.length} Tag(s) Selected`}
                      {selectedAudience.type === 'contacts' &&
                        `${selectedAudience.contacts.length} Contact(s) Selected`}
                    </p>
                    <p className="text-sm text-primary mt-1">
                      {audienceSize} recipients
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-medium text-foreground mt-1">
                      {scheduleType === 'now' ? 'Send Immediately' : 'Scheduled'}
                    </p>
                    {scheduleType === 'scheduled' && (
                      <p className="text-sm text-primary mt-1">
                        {scheduledDate} at {scheduledTime}
                      </p>
                    )}
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Template</p>
                    <p className="font-medium text-foreground mt-1">
                      {selectedTemplate.name}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{selectedTemplate.category}</Badge>
                      <Badge variant="outline">{selectedTemplate.language}</Badge>
                    </div>
                  </div>
                )}

                {broadcastVariables.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Variables</p>
                    <div className="space-y-1">
                      {broadcastVariables.map((v) => {
                        const finalValue = v.variable.trim() || v.value.trim() || v.fallback.trim();
                        const isSystemVariable = v.variable.trim() !== '';
                        return (
                          <div key={v.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{`{{${v.name}}}`}</span>
                              {isSystemVariable && (
                                <Badge variant="outline" className="text-xs">
                                  System
                                </Badge>
                              )}
                            </div>
                            <span className="font-medium text-foreground">{finalValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasMediaHeader && mediaUrl && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Media Header</p>
                    <div className="flex items-center gap-2">
                      {headerFormat === 'IMAGE' && <PhotoIcon className="w-4 h-4" />}
                      {headerFormat === 'VIDEO' && <VideoCameraIcon className="w-4 h-4" />}
                      {headerFormat === 'DOCUMENT' && <DocumentIcon className="w-4 h-4" />}
                      <span className="text-sm text-foreground">
                        {headerFormat} - Uploaded to Cloudinary
                      </span>
                    </div>
                    {mediaFile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Original: {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Please review carefully
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Once sent, messages cannot be recalled. Ensure all details are
                      correct before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Sidebar */}
        <div className="space-y-4">
          {/* Audience Summary */}
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <UsersIcon className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">Audience</h3>
            </div>
            <div className="text-3xl font-bold text-foreground">{audienceSize}</div>
            <p className="text-sm text-muted-foreground">recipients</p>

            {selectedAudience.type === 'tags' && selectedAudience.tags.length > 0 && tags && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
                {selectedAudience.tags.map((tagId) => {
                  const tag = tags.find((t: Tag) => t.id === tagId);
                  return tag ? (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {selectedAudience.type === 'contacts' && selectedAudience.contacts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
                {selectedAudience.contacts.slice(0, 5).map((contactId) => {
                  const contact = contacts.find((c: Contact) => c.id === contactId);
                  return contact ? (
                    <Badge key={contactId} variant="secondary" className="text-xs">
                      {contact.name?.split(' ')[0] || contact.phone?.slice(-4) || 'Contact'}
                    </Badge>
                  ) : null;
                })}
                {selectedAudience.contacts.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedAudience.contacts.length - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Template Preview with media */}
          {selectedTemplate && currentStep >= 2 && (
            <div className="card-gradient rounded-xl p-4">
              <h3 className="font-medium text-foreground mb-3">Message Preview</h3>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-border">
                <div className="mb-2">
                  <Badge variant="secondary">{selectedTemplate.category}</Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">{selectedTemplate.name}</div>
                  {/* Media preview */}
                  {hasMediaHeader && mediaPreview && (
                    <div className="mt-2 mb-3">
                      {headerFormat === 'IMAGE' && (
                        <img
                          src={mediaPreview}
                          alt="Media preview"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      )}
                      {headerFormat === 'VIDEO' && (
                        <div className="h-32 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg flex items-center justify-center">
                          <VideoCameraIcon className="w-8 h-8 text-orange-400" />
                          <span className="ml-2 text-sm">Video attached</span>
                        </div>
                      )}
                      {headerFormat === 'DOCUMENT' && (
                        <div className="h-16 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center">
                          <DocumentIcon className="w-6 h-6 text-green-400" />
                          <span className="ml-2 text-sm">Document attached</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Body preview */}
                  {previewBody && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {previewBody}
                    </div>
                  )}
                  {/* Status indicator */}
                  {hasMediaHeader && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs flex items-center gap-2">
                      {mediaUrl ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>Media: Uploaded to Cloudinary</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span>Media: Not uploaded</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/broadcasts')}>
            Cancel
          </Button>
          {currentStep < 5 ? (
            <Button onClick={handleNext} disabled={!canProceed() || isUploading}>
              {currentStep === 2 && hasMediaHeader && !mediaUrl ? 'Upload & Continue' : 'Next'}
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={!canProceed() || loading || createBroadcastMutation.isPending || isUploading}
              className="gap-2"
            >
              {createBroadcastMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {scheduleType === 'now' ? 'Send Broadcast' : 'Schedule Broadcast'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// TemplateItem component (keep as is)
function TemplateItem({
  template,
  selected,
  onSelect,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}) {
  const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
  const bodyText = bodyComponent?.text || '';

  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">{template.name}</h3>
          <Badge variant={template.status === 'approved' ? 'default' : 'secondary'}>
            {template.status}
          </Badge>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <CheckIcon className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{bodyText}</p>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {template.category}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {template.language}
        </Badge>
      </div>
    </div>
  );
}