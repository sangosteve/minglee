// frontend/src/pages/templates/CreateTemplate.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Image, 
  Video, 
  FileText as FileIcon, 
  Type,
  Link,
  Phone,
  Copy,
  MessageSquare,
  Info,
  Save,
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2,
  Paperclip,
  Eye,
  ExternalLink
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { toast } from "sonner";
import { 
  useCreateTemplate, 
  useUpdateTemplate, 
  useTemplate,
  type Template,
  type TemplateComponent 
} from "@/lib/api/templates";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUploadTemplateMedia } from "@/hooks/use-template-media";

// Language options matching Meta's WhatsApp requirements
const languageOptions = [
  { code: 'en', name: 'English', metaCode: 'en_US' },
  { code: 'en_GB', name: 'English (UK)', metaCode: 'en_GB' },
  { code: 'es', name: 'Spanish', metaCode: 'es_ES' },
  { code: 'fr', name: 'French', metaCode: 'fr_FR' },
  { code: 'de', name: 'German', metaCode: 'de_DE' },
  { code: 'pt', name: 'Portuguese', metaCode: 'pt_PT' },
  { code: 'ar', name: 'Arabic', metaCode: 'ar_AR' },
  { code: 'hi', name: 'Hindi', metaCode: 'hi_IN' },
];

const categoryOptions = [
  { value: 'UTILITY', label: 'Utility', description: 'Transactional and service-related messages' },
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional and marketing messages' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'OTP and security messages' },
];

type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'none';
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface LocalButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

interface MediaFile {
  id?: string;
  url: string;
  secureUrl: string;
  mimeType: string;
  originalFilename: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  publicId?: string;
}

// Validation function based on Meta's rules
const validateTemplate = (templateData: {
  name: string;
  category: string;
  components: TemplateComponent[];
  headerFormat: HeaderFormat;
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: LocalButton[];
  headerMedia: MediaFile | null;
}): string[] => {
  const errors: string[] = [];

  // 1. Validate template name
  if (!templateData.name.trim()) {
    errors.push("Template name is required");
  } else if (!/^[a-z0-9_]+$/.test(templateData.name)) {
    errors.push("Template name must contain only lowercase letters, numbers, and underscores");
  }

  // 2. Validate body is required
  if (!templateData.bodyText.trim()) {
    errors.push("BODY component is required");
  } else if (templateData.bodyText.length > 1024) {
    errors.push("BODY text must be 1024 characters or less");
  }

  // 3. Validate header if present
  if (templateData.headerFormat !== 'none') {
    if (templateData.headerFormat === 'TEXT') {
      if (!templateData.headerText.trim()) {
        errors.push("HEADER TEXT format requires text");
      } else if (templateData.headerText.length > 60) {
        errors.push("HEADER TEXT must be 60 characters or less");
      }
    } else {
      // IMAGE, VIDEO, DOCUMENT headers
      if (!templateData.headerMedia) {
        errors.push(`HEADER ${templateData.headerFormat} requires uploaded media`);
      }
    }
  }

  // 4. Validate footer length
  if (templateData.footerText.length > 60) {
    errors.push("FOOTER text must be 60 characters or less");
  }

  // 5. Validate buttons
  if (templateData.buttons.length > 0) {
    const quickReplies = templateData.buttons.filter(b => b.type === 'QUICK_REPLY');
    const ctas = templateData.buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    
    // Cannot mix button types
    if (quickReplies.length > 0 && ctas.length > 0) {
      errors.push("Cannot mix QUICK_REPLY buttons with URL or PHONE_NUMBER buttons");
    }
    
    // Button count limits
    if (quickReplies.length > 3) {
      errors.push("Maximum 3 QUICK_REPLY buttons allowed");
    }
    
    if (ctas.length > 2) {
      errors.push("Maximum 2 CTA buttons (URL/PHONE_NUMBER) allowed");
    }
    
    // Category-specific rules
    if (templateData.category === 'MARKETING' && quickReplies.length > 0) {
      errors.push("QUICK_REPLY buttons are not allowed in MARKETING templates");
    }
    
    // Validate individual buttons
    templateData.buttons.forEach((button, index) => {
      if (!button.text.trim()) {
        errors.push(`Button ${index + 1} text is required`);
      } else if (button.text.length > 25) {
        errors.push(`Button ${index + 1} text must be 25 characters or less`);
      }
      
      if (button.type === 'URL' && !button.url?.trim()) {
        errors.push(`Button ${index + 1} URL is required for URL buttons`);
      }
      
      if (button.type === 'PHONE_NUMBER' && !button.phone_number?.trim()) {
        errors.push(`Button ${index + 1} phone number is required for PHONE_NUMBER buttons`);
      }
    });
  }

  return errors;
};

const CreateTemplate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const mode = id ? 'edit' : 'create';
  const isDuplicate = location.state?.mode === 'duplicate';
  const duplicateTemplate = location.state?.duplicateTemplate;
  
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<string>("UTILITY");
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("none");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<LocalButton[]>([]);
  const [sampleValues, setSampleValues] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [headerMedia, setHeaderMedia] = useState<MediaFile | null>(null);

  // Custom hook for media upload
  const uploadMediaMutation = useUploadTemplateMedia();

  // Fetch template if editing
  const { data: templateData, isLoading: isLoadingTemplate } = useTemplate(id || '', {
    enabled: !!id && !isDuplicate,
  });

  const createTemplateMutation = useCreateTemplate();
  const updateTemplateMutation = useUpdateTemplate();

  // Extract variables from body text
  const extractVariables = (text: string): number[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
  };

  const variables = extractVariables(bodyText);

  // Load template data for editing or duplication
  useEffect(() => {
    const templateToLoad = isDuplicate ? duplicateTemplate : templateData;
    
    if (templateToLoad) {
      setName(isDuplicate ? `${templateToLoad.name}_copy` : templateToLoad.name);
      setLanguage(templateToLoad.language || 'en');
      setCategory(templateToLoad.category || 'UTILITY');
      setBodyText(templateToLoad.components?.find((c: any) => c.type === 'BODY')?.text || '');
      setFooterText(templateToLoad.components?.find((c: any) => c.type === 'FOOTER')?.text || '');
      
      // Load header
      const header = templateToLoad.components?.find((c: any) => c.type === 'HEADER');
      if (header) {
        setHeaderFormat(header.format || 'none');
        setHeaderText(header.text || '');
        
        // Load media if exists (for editing)
        if (header.format !== 'TEXT' && header.format !== 'none') {
          const headerMediaData = header.example?.header_handle?.[0];
          if (headerMediaData && typeof headerMediaData === 'string') {
            setHeaderMedia({
              url: headerMediaData,
              secureUrl: headerMediaData,
              mimeType: header.format === 'IMAGE' ? 'image/jpeg' : 
                        header.format === 'VIDEO' ? 'video/mp4' : 
                        'application/pdf',
              originalFilename: headerMediaData.split('/').pop() || 'file',
            });
          }
        }
      }
      
      // Load buttons
      const buttonsComponent = templateToLoad.components?.find((c: any) => c.type === 'BUTTONS');
      if (buttonsComponent?.buttons) {
        setButtons(buttonsComponent.buttons.map((btn: any) => ({
          type: btn.type,
          text: btn.text,
          url: btn.url,
          phone_number: btn.phone_number,
        })));
      }
    }
  }, [templateData, isDuplicate, duplicateTemplate]);

  // Handle file selection and upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB for WhatsApp)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size too large", {
        description: "Maximum file size is 10MB for WhatsApp templates"
      });
      return;
    }

    // Validate file type based on header format
    const allowedTypes = {
      IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
      VIDEO: ['video/mp4', 'video/avi', 'video/mov'],
      DOCUMENT: ['application/pdf', 'application/msword', 'text/plain']
    };

    const currentFormat = headerFormat as keyof typeof allowedTypes;
    if (!allowedTypes[currentFormat]?.includes(file.type)) {
      toast.error("Invalid file type", {
        description: `Please select a valid ${headerFormat.toLowerCase()} file`
      });
      return;
    }

    try {
      // Use the mutation for upload
      const result = await uploadMediaMutation.mutateAsync(file);
      
      if (result.success && result.data) {
        const uploadData = result.data;
        
        setHeaderMedia({
          id: uploadData.id,
          url: uploadData.secureUrl,
          secureUrl: uploadData.secureUrl,
          mimeType: file.type,
          originalFilename: file.name,
          fileSize: file.size,
          thumbnailUrl: uploadData.secureUrl,
          publicId: uploadData.publicId,
          width: uploadData.width,
          height: uploadData.height,
          duration: uploadData.duration,
        });

        toast.success("File uploaded successfully", {
          description: `${file.name} is ready to use in your template`
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Don't reset header format, just show error
      toast.error("Upload failed", {
        description: error.message
      });
    } finally {
      // Clear file input
      event.target.value = '';
    }
  };

  const removeHeaderMedia = () => {
    setHeaderMedia(null);
    toast.info("Media removed", {
      description: "File has been removed from the template header"
    });
  };

  const addButton = () => {
    const quickReplies = buttons.filter(b => b.type === 'QUICK_REPLY');
    const ctas = buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    
    // Check max button limits
    if (quickReplies.length > 0 && ctas.length > 0) {
      toast.error("Cannot mix button types", {
        description: "Cannot mix QUICK_REPLY buttons with URL or PHONE_NUMBER buttons"
      });
      return;
    }
    
    if (quickReplies.length > 0 && quickReplies.length >= 3) {
      toast.error("Maximum 3 QUICK_REPLY buttons allowed");
      return;
    }
    
    if (ctas.length > 0 && ctas.length >= 2) {
      toast.error("Maximum 2 CTA buttons (URL/PHONE_NUMBER) allowed");
      return;
    }
    
    if (buttons.length >= 3) {
      toast.error("Maximum 3 buttons total allowed");
      return;
    }
    
    // Determine default button type based on existing buttons and category
    let defaultType: ButtonType = 'QUICK_REPLY';
    
    if (category === 'MARKETING') {
      defaultType = 'URL'; // MARKETING doesn't allow QUICK_REPLY
    } else if (buttons.length > 0) {
      // Keep same type as existing buttons
      defaultType = buttons[0].type;
    }
    
    setButtons([...buttons, { type: defaultType, text: '' }]);
  };

  const updateButton = (index: number, updates: Partial<LocalButton>) => {
    const newButtons = [...buttons];
    const oldButton = newButtons[index];
    const newButton = { ...oldButton, ...updates };
    
    // Check if changing button type violates mixing rules
    if (updates.type && updates.type !== oldButton.type) {
      const otherButtons = newButtons.filter((_, i) => i !== index);
      const otherTypes = [...new Set(otherButtons.map(b => b.type))];
      
      // If we have other buttons of different type, don't allow mixing
      if (otherTypes.length > 0 && !otherTypes.includes(updates.type)) {
        toast.error("Cannot mix button types", {
          description: "Cannot mix QUICK_REPLY buttons with URL or PHONE_NUMBER buttons"
        });
        return;
      }
    }
    
    newButtons[index] = newButton;
    setButtons(newButtons);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const buildPreviewTemplate = (): Template => {
    const components: any[] = [];

    if (headerFormat !== 'none') {
      const headerComponent: any = {
        type: 'header',
        format: headerFormat.toLowerCase(),
      };
      
      if (headerFormat === 'TEXT' && headerText) {
        headerComponent.text = headerText;
        const headerVars = extractVariables(headerText);
        if (headerVars.length > 0) {
          headerComponent.example = {
            header_text: headerVars.map(v => sampleValues[v] || `Sample ${v}`)
          };
        }
      }
      
      if (headerFormat !== 'TEXT') {
        // Use uploaded media URL or placeholder for preview
        headerComponent.example = { 
          header_handle: [headerMedia?.secureUrl || 'https://via.placeholder.com/800x400?text=Template+Header'] 
        };
      }
      
      components.push(headerComponent);
    }

    if (bodyText) {
      const sampleArray = variables.map(v => sampleValues[v] || `Value ${v}`);
      components.push({
        type: 'body',
        text: bodyText,
        example: { body_text: [sampleArray] },
      });
    }

    if (footerText) {
      components.push({
        type: 'footer',
        text: footerText,
      });
    }

    if (buttons.length > 0) {
      // Filter out QUICK_REPLY buttons for MARKETING in preview too
      let previewButtons = buttons.filter(b => b.text);
      if (category === 'MARKETING') {
        previewButtons = previewButtons.filter(btn => btn.type !== 'QUICK_REPLY');
      }
      
      if (previewButtons.length > 0) {
        components.push({
          type: 'buttons',
          buttons: previewButtons.map(btn => ({
            ...btn,
            type: btn.type
          })),
        });
      }
    }

    return {
      id: 'preview',
      name: name || 'untitled_template',
      language: languageOptions.find(l => l.code === language)?.name || 'English',
      status: 'pending',
      category: category as any,
      components,
      userId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Template;
  };

  const buildTemplateComponents = (): TemplateComponent[] => {
    const components: TemplateComponent[] = [];

    // Add header if not "none"
    if (headerFormat !== 'none') {
      const headerComponent: any = {
        type: 'HEADER',
        format: headerFormat,
      };
      
      if (headerFormat === 'TEXT' && headerText) {
        headerComponent.text = headerText;
        // Extract variables for example
        const headerVars = extractVariables(headerText);
        if (headerVars.length > 0) {
          headerComponent.example = {
            header_text: headerVars.map(v => `Sample ${v}`)
          };
        }
      } else if (headerFormat !== 'TEXT') {
        // CRITICAL: ALWAYS add example for media headers (Meta requirement)
        // Even if it's a placeholder, it must be present
        const mediaUrl = headerMedia?.secureUrl;
        if (mediaUrl) {
          headerComponent.example = {
            header_handle: [mediaUrl]
          };
        } else {
          // If no media uploaded yet, use a placeholder (will be replaced by Meta)
          headerComponent.example = {
            header_handle: [
              headerFormat === 'IMAGE' ? 'https://example.com/sample-image.jpg' :
              headerFormat === 'VIDEO' ? 'https://example.com/sample-video.mp4' :
              'https://example.com/sample-document.pdf'
            ]
          };
        }
      }
      
      components.push(headerComponent);
    }

    // Add body
    if (bodyText) {
      const bodyComponent: any = {
        type: 'BODY',
        text: bodyText,
      };
      
      if (variables.length > 0) {
        const examples = variables.map(v => sampleValues[v] || `Sample ${v}`);
        bodyComponent.example = {
          body_text: [examples]
        };
      }
      
      components.push(bodyComponent);
    }

    // Add footer
    if (footerText) {
      components.push({
        type: 'FOOTER',
        text: footerText,
      });
    }

    // Add buttons with MARKETING template restrictions
    if (buttons.length > 0) {
      // Filter out QUICK_REPLY buttons if category is MARKETING
      const filteredButtons = buttons.filter(b => b.text.trim());
      
      // Apply MARKETING restrictions
      let finalButtons = filteredButtons;
      if (category === 'MARKETING') {
        // Remove QUICK_REPLY buttons for MARKETING templates
        finalButtons = filteredButtons.filter(btn => btn.type !== 'QUICK_REPLY');
      }
      
      if (finalButtons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: finalButtons,
        });
      }
    }

    return components;
  };

  const handleSubmit = async () => {
    // Validate using Meta's rules
    const validationErrors = validateTemplate({
      name,
      category,
      components: buildTemplateComponents(),
      headerFormat,
      headerText,
      bodyText,
      footerText,
      buttons,
      headerMedia,
    });

    if (validationErrors.length > 0) {
      // Show first error
      toast.error("Validation failed", {
        description: validationErrors[0]
      });
      
      // Log all errors for debugging
      if (validationErrors.length > 1) {
        console.log("All validation errors:", validationErrors);
      }
      return;
    }

    const components = buildTemplateComponents();
    const variablesList = variables.map(v => ({
      name: v.toString(),
      type: 'text' as const,
      required: false,
      example: sampleValues[v] || `Sample ${v}`,
      description: `Variable ${v}`
    }));

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        await createTemplateMutation.mutateAsync({
          name,
          category,
          language: languageOptions.find(l => l.code === language)?.metaCode || language,
          components,
          variables: variablesList,
        }, {
          onSuccess: (result) => {
            if (result?.success) {
              toast.success("Template submitted for approval", {
                description: "Meta will review your template within 24-48 hours"
              });
              navigate(`/templates/${result.data.id}`);
            } else {
              toast.error("Failed to create template", {
                description: result?.error || "Unknown error"
              });
            }
          },
          onError: (error: any) => {
            toast.error("Failed to create template", {
              description: error?.response?.data?.message || error?.message || "Unknown error occurred"
            });
          }
        });
      } else if (mode === 'edit' && id) {
        await updateTemplateMutation.mutateAsync({
          id,
          data: {
            name,
            category,
            language: languageOptions.find(l => l.code === language)?.metaCode || language,
            components,
            variables: variablesList,
          },
        }, {
          onSuccess: (result) => {
            if (result?.success) {
              toast.success("Template updated successfully");
              navigate(`/templates/${id}`);
            } else {
              toast.error("Failed to update template");
            }
          },
          onError: (error: any) => {
            toast.error("Failed to update template", {
              description: error?.response?.data?.message || error?.message || "Unknown error occurred"
            });
          }
        });
      }
    } catch (error: any) {
      toast.error("Submission failed", {
        description: error?.message || "An unexpected error occurred"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaIcon = () => {
    switch (headerFormat) {
      case 'IMAGE':
        return <Image className="h-8 w-8 text-blue-500" />;
      case 'VIDEO':
        return <Video className="h-8 w-8 text-purple-500" />;
      case 'DOCUMENT':
        return <FileIcon className="h-8 w-8 text-green-500" />;
      default:
        return null;
    }
  };

  const isUploading = uploadMediaMutation.isPending;

  // Helper to check if we can add more buttons
  const canAddMoreButtons = () => {
    if (buttons.length >= 3) return false;
    
    const quickReplies = buttons.filter(b => b.type === 'QUICK_REPLY');
    const ctas = buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    
    if (quickReplies.length > 0 && quickReplies.length >= 3) return false;
    if (ctas.length > 0 && ctas.length >= 2) return false;
    
    return true;
  };

  // Helper to get button type restrictions
  const getButtonTypeRestrictions = () => {
    const quickReplies = buttons.filter(b => b.type === 'QUICK_REPLY');
    const ctas = buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    
    if (quickReplies.length > 0) return { allowed: ['QUICK_REPLY'], max: 3 - quickReplies.length };
    if (ctas.length > 0) return { allowed: ['URL', 'PHONE_NUMBER'], max: 2 - ctas.length };
    
    // No buttons yet, default based on category
    if (category === 'MARKETING') return { allowed: ['URL', 'PHONE_NUMBER'], max: 2 };
    return { allowed: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'], max: 3 };
  };

  if (mode === 'edit' && isLoadingTemplate) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg"></div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="h-96 bg-muted rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const buttonRestrictions = getButtonTypeRestrictions();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === 'edit' ? 'Edit Template' : isDuplicate ? 'Duplicate Template' : 'Create Template'}
            </h1>
            <p className="text-muted-foreground">Create a new WhatsApp message template</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isUploading}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'edit' ? 'Update Template' : 'Submit for Approval'}
              </>
            )}
          </Button>
        </div>
      </div>

      {mode === 'edit' && templateData?.metaTemplateId && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Note: Editing this template will create a new version in WhatsApp. The original template will be replaced.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set the template name, language, and category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., order_confirmation"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language *</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <RadioGroup 
                  value={category} 
                  onValueChange={(v) => {
                    setCategory(v);
                    
                    // If switching to MARKETING, remove QUICK_REPLY buttons
                    if (v === 'MARKETING') {
                      const hasQuickReply = buttons.some(btn => btn.type === 'QUICK_REPLY');
                      if (hasQuickReply) {
                        setButtons(buttons.filter(btn => btn.type !== 'QUICK_REPLY'));
                        toast.warning("QUICK_REPLY buttons removed", {
                          description: "QUICK_REPLY buttons are not allowed in MARKETING templates. They have been removed automatically."
                        });
                      }
                    }
                  }} 
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  {categoryOptions.map(cat => (
                    <Label
                      key={cat.value}
                      htmlFor={cat.value}
                      className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        category === cat.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={cat.value} id={cat.value} className="mt-0.5" />
                      <div>
                        <p className="font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle>Header (Optional)</CardTitle>
              <CardDescription>Add a header to make your message stand out</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={headerFormat} 
                onValueChange={(v) => {
                  setHeaderFormat(v as HeaderFormat);
                  if (v === 'none' || v === 'TEXT') {
                    setHeaderMedia(null);
                  }
                }}
                className="flex flex-wrap gap-2"
              >
                {[
                  { value: 'none', label: 'None', icon: null },
                  { value: 'TEXT', label: 'Text', icon: Type },
                  { value: 'IMAGE', label: 'Image', icon: Image },
                  { value: 'VIDEO', label: 'Video', icon: Video },
                  { value: 'DOCUMENT', label: 'Document', icon: FileIcon },
                ].map(opt => (
                  <Label
                    key={opt.value}
                    htmlFor={`header-${opt.value}`}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                      headerFormat === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} id={`header-${opt.value}`} className="sr-only" />
                    {opt.icon && <opt.icon className="h-4 w-4" />}
                    {opt.label}
                  </Label>
                ))}
              </RadioGroup>

              {headerFormat === 'TEXT' && (
                <div className="space-y-2">
                  <Label htmlFor="headerText">Header Text</Label>
                  <Input
                    id="headerText"
                    placeholder="Enter header text..."
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground text-right">{headerText.length}/60</p>
                </div>
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
                <div className="space-y-4">
                  {headerMedia ? (
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getMediaIcon()}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{headerMedia.originalFilename}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(headerMedia.fileSize || 0)}</span>
                              <span>•</span>
                              <span>{headerMedia.mimeType.split('/')[1].toUpperCase()}</span>
                              {headerMedia.width && headerMedia.height && (
                                <>
                                  <span>•</span>
                                  <span>{headerMedia.width}×{headerMedia.height}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(headerMedia.secureUrl, '_blank')}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={removeHeaderMedia}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {headerFormat === 'IMAGE' && (
                        <div className="rounded-md overflow-hidden border mb-3">
                          <img 
                            src={headerMedia.thumbnailUrl || headerMedia.url} 
                            alt="Header preview" 
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('header-file-upload')?.click()}
                            disabled={isUploading}
                          >
                            Replace File
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(headerMedia.secureUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                      <input
                        id="header-file-upload"
                        type="file"
                        accept={
                          headerFormat === 'IMAGE' ? 'image/*' :
                          headerFormat === 'VIDEO' ? 'video/*' :
                          '.pdf,.doc,.docx,.txt'
                        }
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div className="flex flex-col items-center gap-3">
                        {getMediaIcon()}
                        <div>
                          <p className="text-sm font-medium">Upload {headerFormat.toLowerCase()} file</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {headerFormat === 'IMAGE' ? 'JPG, PNG, GIF (max 10MB)' :
                             headerFormat === 'VIDEO' ? 'MP4, AVI, MOV (max 10MB)' :
                             'PDF, DOC, TXT (max 10MB)'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('header-file-upload')?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Select File
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {isUploading && (
                        <div className="mt-4 space-y-2">
                          <Progress value={uploadMediaMutation.variables?.size ? 
                            (uploadMediaMutation.variables.size / (10 * 1024 * 1024)) * 100 : 50} 
                            className="h-2" 
                          />
                          <p className="text-xs text-muted-foreground">
                            Uploading {uploadMediaMutation.variables?.name}...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      WhatsApp will host the final media. The uploaded file URL will be used when sending the template.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardHeader>
              <CardTitle>Body *</CardTitle>
              <CardDescription>
                Write your message. Use {'{{1}}'}, {'{{2}}'}, etc. for variables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Hi {{1}}, your order #{{2}} has been confirmed..."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  maxLength={1024}
                />
                <p className="text-xs text-muted-foreground text-right">{bodyText.length}/1024</p>
              </div>

              {variables.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Sample Values (for preview)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {variables.map(v => (
                      <div key={v} className="space-y-1">
                        <Label className="text-xs">{`{{${v}}}`}</Label>
                        <Input
                          placeholder={`Sample for {{${v}}}`}
                          value={sampleValues[v] || ''}
                          onChange={(e) => setSampleValues({ ...sampleValues, [v]: e.target.value })}
                          className="h-9"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Footer (Optional)</CardTitle>
              <CardDescription>Add a short footer text</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  placeholder="e.g., Reply STOP to unsubscribe"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground text-right">{footerText.length}/60</p>
              </div>
            </CardContent>
          </Card>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Buttons (Optional)</CardTitle>
                  <CardDescription>
                    Add up to 3 buttons. {category === 'MARKETING' && 'QUICK_REPLY buttons not allowed for MARKETING.'}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addButton} 
                  disabled={!canAddMoreButtons()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Button ({buttons.length}/3)
                </Button>
              </div>
            </CardHeader>
            
            {category === 'MARKETING' && (
              <Alert className="mx-6 mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Note:</strong> MARKETING templates only support <strong>URL</strong> and <strong>PHONE_NUMBER</strong> buttons. 
                  QUICK_REPLY buttons are not allowed for this category.
                </AlertDescription>
              </Alert>
            )}
            
            {buttons.length > 0 && (
              <CardContent className="space-y-4">
                {buttons.map((button, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">Button {index + 1}</Label>
                        {category === 'MARKETING' && button.type === 'QUICK_REPLY' && (
                          <Badge variant="destructive" className="text-xs">
                            Not Allowed
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeButton(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Button Type</Label>
                      <RadioGroup
                        value={button.type}
                        onValueChange={(v) => {
                          // Prevent switching to QUICK_REPLY for MARKETING
                          if (category === 'MARKETING' && v === 'QUICK_REPLY') {
                            toast.error("QUICK_REPLY not allowed", {
                              description: "QUICK_REPLY buttons are not allowed in MARKETING templates"
                            });
                            return;
                          }
                          
                          // Check if this button type is allowed with current button mix
                          if (!buttonRestrictions.allowed.includes(v as ButtonType)) {
                            toast.error("Cannot mix button types", {
                              description: `Cannot mix ${v} buttons with ${buttons[0].type} buttons`
                            });
                            return;
                          }
                          
                          updateButton(index, { type: v as ButtonType });
                        }}
                        className="flex flex-wrap gap-2"
                      >
                        {[
                          { 
                            value: 'QUICK_REPLY' as const, 
                            label: 'Quick Reply', 
                            icon: MessageSquare, 
                            disabled: category === 'MARKETING' || !buttonRestrictions.allowed.includes('QUICK_REPLY')
                          },
                          { 
                            value: 'URL' as const, 
                            label: 'URL', 
                            icon: Link, 
                            disabled: !buttonRestrictions.allowed.includes('URL')
                          },
                          { 
                            value: 'PHONE_NUMBER' as const, 
                            label: 'Phone', 
                            icon: Phone, 
                            disabled: !buttonRestrictions.allowed.includes('PHONE_NUMBER')
                          },
                        ].map(opt => (
                          <Label
                            key={opt.value}
                            htmlFor={`btn-${index}-${opt.value}`}
                            className={`flex items-center gap-2 px-3 py-1.5 border rounded cursor-pointer text-sm transition-colors ${
                              button.type === opt.value ? 'border-primary bg-primary/5' :
                              opt.disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' :
                              'hover:bg-muted/50'
                            }`}
                          >
                            <RadioGroupItem 
                              value={opt.value} 
                              id={`btn-${index}-${opt.value}`} 
                              className="sr-only"
                              disabled={opt.disabled}
                            />
                            <opt.icon className="h-3 w-3" />
                            {opt.label}
                            {opt.disabled && (
                              <span className="text-xs text-muted-foreground">
                                {category === 'MARKETING' && opt.value === 'QUICK_REPLY' ? '(not allowed)' : ''}
                              </span>
                            )}
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Button Text *</Label>
                        <Input
                          placeholder="Button text"
                          value={button.text}
                          onChange={(e) => updateButton(index, { text: e.target.value })}
                          maxLength={25}
                        />
                        <p className="text-xs text-muted-foreground">{button.text.length}/25</p>
                      </div>
                      {button.type === 'URL' && (
                        <div className="space-y-2">
                          <Label className="text-xs">URL *</Label>
                          <Input
                            placeholder="https://example.com"
                            value={button.url || ''}
                            onChange={(e) => updateButton(index, { url: e.target.value })}
                          />
                        </div>
                      )}
                      {button.type === 'PHONE_NUMBER' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Phone Number *</Label>
                          <Input
                            placeholder="+1234567890"
                            value={button.phone_number || ''}
                            onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {buttons.length > 0 && buttonRestrictions.max > 0 && (
                  <div className="text-sm text-muted-foreground">
                    You can add {buttonRestrictions.max} more {buttonRestrictions.allowed.join('/')} button{buttonRestrictions.max > 1 ? 's' : ''}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>See how your template will look</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePreview template={buildPreviewTemplate()} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplate;