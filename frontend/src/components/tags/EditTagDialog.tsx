// frontend/src/components/tags/EditTagDialog.tsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { tagsApi, type Tag, type UpdateTagDto } from '@/lib/api/tags';
import { PencilIcon } from '@heroicons/react/24/outline';

// Predefined color options (same as CreateTagDialog)
const COLOR_OPTIONS = [
  { value: '#3B82F6', label: 'Blue', bg: 'bg-blue-500' },
  { value: '#EF4444', label: 'Red', bg: 'bg-red-500' },
  { value: '#10B981', label: 'Green', bg: 'bg-green-500' },
  { value: '#F59E0B', label: 'Amber', bg: 'bg-amber-500' },
  { value: '#8B5CF6', label: 'Violet', bg: 'bg-violet-500' },
  { value: '#EC4899', label: 'Pink', bg: 'bg-pink-500' },
  { value: '#6366F1', label: 'Indigo', bg: 'bg-indigo-500' },
  { value: '#14B8A6', label: 'Teal', bg: 'bg-teal-500' },
  { value: '#F97316', label: 'Orange', bg: 'bg-orange-500' },
  { value: '#8B5CF6', label: 'Purple', bg: 'bg-purple-500' },
];

interface EditTagDialogProps {
  tag: Tag;
  trigger?: React.ReactNode;
  onSuccess?: (tag: Tag) => void;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function EditTagDialog({
  tag,
  trigger,
  onSuccess,
  onOpenChange,
  defaultOpen = false,
}: EditTagDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [formData, setFormData] = useState<UpdateTagDto>({
    name: tag.name,
    description: tag.description,
    color: tag.color,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: (data: UpdateTagDto) => tagsApi.update(tag.id, data),
    onSuccess: (updatedTag) => {
      // Invalidate and refetch tags list
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      
      // Reset form
      setErrors({});
      
      // Close dialog
      setOpen(false);
      
      // Call success callback
      onSuccess?.(updatedTag);
    },
    onError: (error: any) => {
      // Handle API errors
      if (error.response?.data?.error) {
        setErrors({ form: error.response.data.error });
      } else {
        setErrors({ form: 'Failed to update tag. Please try again.' });
      }
    },
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: tag.name,
        description: tag.description,
        color: tag.color,
      });
      setErrors({});
    }
  }, [open, tag]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
    
    // Reset form when closing
    if (!newOpen) {
      setErrors({});
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      validationErrors.name = 'Tag name is required';
    }
    
    if (formData.name?.trim() && formData.name.trim().length > 100) {
      validationErrors.name = 'Tag name must be less than 100 characters';
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Submit form
    updateTagMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof UpdateTagDto, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const isFormValid = 
    formData.name?.trim().length > 0 && 
    formData.name.trim().length <= 100 &&
    (formData.name !== tag.name || 
     formData.description !== tag.description || 
     formData.color !== tag.color);

  // Default trigger button
  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
      <PencilIcon className="w-3 h-3" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update your tag details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Form Error */}
            {errors.form && (
              <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
                {errors.form}
              </div>
            )}
            
            {/* Tag Name */}
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Tag name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={cn(errors.name && 'border-destructive')}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            
            {/* Color Selection */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Colors</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                      color.bg,
                      formData.color === color.value
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-transparent"
                    )}
                    onClick={() => handleInputChange('color', color.value)}
                    aria-label={`Select ${color.label} color`}
                  />
                ))}
              </div>
            </div>
            
            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your Tag here"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={updateTagMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || updateTagMutation.isPending}
            >
              {updateTagMutation.isPending ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Updating...
                </>
              ) : (
                'Update Tag'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoadingSpinner(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}