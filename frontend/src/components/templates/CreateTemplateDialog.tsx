// frontend/src/components/templates/CreateTemplateDialog.tsx
import { useState } from 'react';
import { useCreateTemplate } from '@/lib/api/templates';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { PlusIcon } from '@heroicons/react/24/outline';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { VariableService } from '@/lib/variable-service';
import { SYSTEM_VARIABLES, VARIABLE_CATEGORIES } from '@/lib/system-variables';

// Define TemplateVariable interface
interface TemplateVariable {
  name: string;
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  required: boolean;
  example?: string;
  description?: string;
}

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  category: z.string().optional(),
  language: z.string().default('en'),
  components: z.array(
    z.object({
      type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
      format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
      text: z.string().optional(),
      example: z.any().optional(),
      buttons: z.array(
        z.object({
          type: z.enum(['QUICK_REPLY', 'URL']),
          text: z.string(),
          url: z.string().optional(),
          phone_number: z.string().optional(),
        })
      ).optional(),
    })
  ).min(1, 'At least one component is required'),
  variables: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']),
      required: z.boolean().default(false),
      example: z.string().optional(),
      description: z.string().optional(),
    })
  ).optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (templateId: string) => void;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTemplateDialogProps) {
  const [componentType, setComponentType] = useState<'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'>('BODY');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [components, setComponents] = useState<any[]>([
    {
      type: 'BODY',
      text: '',
    },
  ]);
  const [showVariableHelper, setShowVariableHelper] = useState(false);

  const createTemplate = useCreateTemplate();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      category: '',
      language: 'en',
      components: [],
      variables: [],
    },
  });

const onSubmit = async (data: TemplateFormData) => {
  try {
    // Validate template name for Meta
    const nameRegex = /^[a-z0-9_]+$/;
    if (!nameRegex.test(data.name)) {
      toast({
        title: '❌ Invalid Template Name',
        description: 'Template name must be lowercase with numbers/underscores only (e.g., welcome_message, order_123)',
        variant: 'destructive',
      });
      return;
    }

    // Ensure we have at least BODY component with text
    const hasValidBody = components.some(c => 
      c.type === 'BODY' && c.text?.trim()
    );
    
    if (!hasValidBody) {
      toast({
        title: '❌ Missing Body',
        description: 'Template must have at least one BODY component with text',
        variant: 'destructive',
      });
      return;
    }

    const result = await createTemplate.mutateAsync({
      ...data,
      components,
      variables,
    });

    if (result.success) {
      toast({
        title: result.data.metaTemplateId ? '✅ Template Submitted!' : '⚠️ Template Saved Locally',
        description: result.message || 'Template created successfully',
        className: result.data.metaTemplateId 
          ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
          : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
      });
      
      form.reset();
      setComponents([{ type: 'BODY', text: '' }]);
      setVariables([]);
      
      if (onSuccess) {
        onSuccess(result.data.id);
      }
      
      onOpenChange(false);
    } else {
      // Show Meta-specific errors
      if (result.metaError) {
        toast({
          title: '❌ WhatsApp API Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '❌ Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    }
  } catch (error: any) {
    toast({
      title: '❌ Error',
      description: error.message || 'Failed to create template',
      variant: 'destructive',
    });
  }
};

  const addComponent = () => {
    const newComponent: any = { type: componentType };
    
    if (componentType === 'BODY') {
      newComponent.text = '';
    } else if (componentType === 'HEADER') {
      newComponent.format = 'TEXT';
      newComponent.text = '';
    } else if (componentType === 'FOOTER') {
      newComponent.text = '';
    } else if (componentType === 'BUTTONS') {
      newComponent.buttons = [];
    }
    
    setComponents([...components, newComponent]);
    setComponentType('BODY');
  };

  const updateComponent = (index: number, updates: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], ...updates };
    setComponents(updated);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: `var${variables.length + 1}`,
      type: 'text',
      required: false,
      example: '',
      description: '',
    };
    setVariables([...variables, newVariable]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], ...updates };
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Helper function to extract variables from text
  const extractVariablesFromText = (text: string): string[] => {
    return VariableService.extractVariables(text);
  };

  // Get all variables from all BODY components
  const getAllVariables = (): string[] => {
    const allVariables = new Set<string>();
    components.forEach(component => {
      if (component.type === 'BODY' && component.text) {
        const vars = extractVariablesFromText(component.text);
        vars.forEach(v => allVariables.add(v));
      }
    });
    return Array.from(allVariables);
  };

  // Insert a system variable into the text
  const insertSystemVariable = (variable: { key: string; label: string }) => {
    const variablePlaceholder = `{{${variable.key}}}`;
    const activeTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (activeTextarea) {
      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      const text = activeTextarea.value;
      const newText = text.substring(0, start) + variablePlaceholder + text.substring(end);
      activeTextarea.value = newText;
      
      // Update the state for the active component
      const activeIndex = components.findIndex(c => c.type === 'BODY');
      if (activeIndex !== -1) {
        updateComponent(activeIndex, { text: newText });
      }
      
      // Focus back on the textarea
      activeTextarea.focus();
      activeTextarea.setSelectionRange(start + variablePlaceholder.length, start + variablePlaceholder.length);
    }
  };

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ar', label: 'Arabic' },
  ];

  const categoryOptions = [
    { value: 'UTILITY', label: 'Utility' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'AUTHENTICATION', label: 'Authentication' },
    { value: 'TRANSACTIONAL', label: 'Transactional' },
  ];

  const detectedVariables = getAllVariables();
  const definedVariableNames = variables.map(v => v.name);
  const undefinedVariables = detectedVariables.filter(v => !definedVariableNames.includes(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Create New Template
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new WhatsApp message template with customizable components and variables.
            Use double curly braces for variables: &#123;&#123;variable_name&#125;&#125;
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Template Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Welcome Message, Order Confirmation"
                        className="bg-background border-border"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border">
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border">
                        {languageOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Variable Helper */}
            <div className="bg-muted/30 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">Available System Variables</h3>
                  <p className="text-sm text-muted-foreground">
                    Insert variables using double curly braces: &#123;&#123;variable_name&#125;&#125;
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVariableHelper(!showVariableHelper)}
                  className="border-border hover:bg-accent"
                >
                  {showVariableHelper ? 'Hide Variables' : 'Show Variables'}
                </Button>
              </div>
              
              {showVariableHelper && (
                <div className="space-y-4">
                  {VARIABLE_CATEGORIES.map((category) => (
                    <div key={category.key} className="space-y-2">
                      <h4 className="text-sm font-medium text-foreground">{category.label}</h4>
                      <div className="flex flex-wrap gap-2">
                        {SYSTEM_VARIABLES
                          .filter(v => v.category === category.key)
                          .map((variable) => (
                            <button
                              key={variable.key}
                              type="button"
                              onClick={() => insertSystemVariable(variable)}
                              className="text-xs bg-background hover:bg-accent border border-border rounded px-2 py-1 text-foreground cursor-pointer"
                              title={`${variable.description} (Example: ${variable.example})`}
                            >
                              &#123;&#123;{variable.key}&#125;&#125;
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Components Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Components</h3>
                  <p className="text-sm text-muted-foreground">
                    Add components like header, body, footer, and buttons to your template
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Select value={componentType} onValueChange={(value: any) => setComponentType(value)}>
                    <SelectTrigger className="w-40 bg-background border-border">
                      <SelectValue placeholder="Component type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="HEADER">Header</SelectItem>
                      <SelectItem value="BODY">Body</SelectItem>
                      <SelectItem value="FOOTER">Footer</SelectItem>
                      <SelectItem value="BUTTONS">Buttons</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    type="button"
                    onClick={addComponent}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Component
                  </Button>
                </div>
              </div>

              {components.length === 0 ? (
                <div className="bg-muted/30 rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground">
                    No components added yet. Add your first component above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {components.map((component, index) => (
                    <div
                      key={index}
                      className="bg-background rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {component.type}
                            {component.format && ` (${component.format})`}
                          </span>
                          {component.type === 'BODY' && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComponent(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      {component.type === 'BODY' && (
                        <div className="space-y-4">
                          <Textarea
                            value={component.text || ''}
                            onChange={(e) => updateComponent(index, { text: e.target.value })}
                            placeholder="Enter template body text. Use {{variable_name}} for variables."
                            className="min-h-[120px] bg-background border-border"
                          />
                          <div className="text-sm text-muted-foreground">
                            <p>
                              Variables detected: {
                                extractVariablesFromText(component.text || '').join(', ') || 'None'
                              }
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {component.type === 'HEADER' && (
                        <div className="space-y-4">
                          <Select
                            value={component.format || 'TEXT'}
                            onValueChange={(value) => updateComponent(index, { format: value })}
                          >
                            <SelectTrigger className="bg-background border-border">
                              <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="TEXT">Text</SelectItem>
                              <SelectItem value="IMAGE">Image</SelectItem>
                              <SelectItem value="VIDEO">Video</SelectItem>
                              <SelectItem value="DOCUMENT">Document</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {component.format === 'TEXT' && (
                            <Input
                              value={component.text || ''}
                              onChange={(e) => updateComponent(index, { text: e.target.value })}
                              placeholder="Header text"
                              className="bg-background border-border"
                            />
                          )}
                        </div>
                      )}
                      
                      {component.type === 'FOOTER' && (
                        <Textarea
                          value={component.text || ''}
                          onChange={(e) => updateComponent(index, { text: e.target.value })}
                          placeholder="Footer text (optional)"
                          className="min-h-[80px] bg-background border-border"
                        />
                      )}
                      
                      {component.type === 'BUTTONS' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                              Add up to 3 buttons (Quick Reply or URL)
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const buttons = component.buttons || [];
                                updateComponent(index, {
                                  buttons: [...buttons, { type: 'QUICK_REPLY', text: '' }],
                                });
                              }}
                              disabled={(component.buttons?.length || 0) >= 3}
                            >
                              Add Button
                            </Button>
                          </div>
                          
                          {(component.buttons || []).map((button: any, buttonIndex: number) => (
                            <div key={buttonIndex} className="flex gap-2 items-center">
                              <Select
                                value={button.type}
                                onValueChange={(value) => {
                                  const buttons = [...(component.buttons || [])];
                                  buttons[buttonIndex] = { ...buttons[buttonIndex], type: value };
                                  updateComponent(index, { buttons });
                                }}
                              >
                                <SelectTrigger className="w-32 bg-background border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                                  <SelectItem value="URL">URL</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input
                                value={button.text}
                                onChange={(e) => {
                                  const buttons = [...(component.buttons || [])];
                                  buttons[buttonIndex] = { ...buttons[buttonIndex], text: e.target.value };
                                  updateComponent(index, { buttons });
                                }}
                                placeholder="Button text"
                                className="flex-1 bg-background border-border"
                              />
                              
                              {button.type === 'URL' && (
                                <Input
                                  value={button.url || ''}
                                  onChange={(e) => {
                                    const buttons = [...(component.buttons || [])];
                                    buttons[buttonIndex] = { ...buttons[buttonIndex], url: e.target.value };
                                    updateComponent(index, { buttons });
                                  }}
                                  placeholder="URL"
                                  className="flex-1 bg-background border-border"
                                />
                              )}
                              
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const buttons = (component.buttons || []).filter((_, i) => i !== buttonIndex);
                                  updateComponent(index, { buttons });
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variables Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Custom Variables</h3>
                  <p className="text-sm text-muted-foreground">
                    Define variables that will be replaced when sending the template
                  </p>
                  
                  {undefinedVariables.length > 0 && (
                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        <span className="font-medium">Undefined variables detected:</span>{' '}
                        {undefinedVariables.join(', ')}
                      </p>
                      <p className="text-xs mt-1">
                        These variables are used in your template but not defined below.
                      </p>
                    </div>
                  )}
                </div>
                
                <Button
                  type="button"
                  onClick={addVariable}
                  variant="outline"
                  className="gap-2 border-border hover:bg-accent"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Variable
                </Button>
              </div>

              {variables.length === 0 ? (
                <div className="bg-muted/30 rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground">
                    No custom variables defined. Add variables that match the variable_name patterns in your components.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {variables.map((variable, index) => (
                    <div
                      key={index}
                      className="bg-background rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">
                            Variable: {variable.name}
                          </h4>
                          {detectedVariables.includes(variable.name) ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                              In Use
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              Not Used
                            </Badge>
                          )}
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Name *
                          </label>
                          <Input
                            value={variable.name}
                            onChange={(e) => updateVariable(index, { name: e.target.value })}
                            placeholder="variable_name"
                            className="bg-background border-border"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Type *
                          </label>
                          <Select
                            value={variable.type}
                            onValueChange={(value: TemplateVariable['type']) => updateVariable(index, { type: value })}
                          >
                            <SelectTrigger className="bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="currency">Currency</SelectItem>
                              <SelectItem value="date_time">Date Time</SelectItem>
                              <SelectItem value="image">Image</SelectItem>
                              <SelectItem value="document">Document</SelectItem>
                              <SelectItem value="video">Video</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center space-x-2 pt-2">
                          <Checkbox
                            id={`required-${index}`}
                            checked={variable.required}
                            onCheckedChange={(checked) => 
                              updateVariable(index, { required: checked === true })
                            }
                            className="border-border"
                          />
                          <label
                            htmlFor={`required-${index}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Required
                          </label>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Example Value
                          </label>
                          <Input
                            value={variable.example || ''}
                            onChange={(e) => updateVariable(index, { example: e.target.value })}
                            placeholder="Example value for preview"
                            className="bg-background border-border"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">
                            Description
                          </label>
                          <Input
                            value={variable.description || ''}
                            onChange={(e) => updateVariable(index, { description: e.target.value })}
                            placeholder="Variable description"
                            className="bg-background border-border"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border hover:bg-accent text-foreground"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={createTemplate.isPending}
              >
                {createTemplate.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}