// frontend/src/components/contacts/AddContactSheet.tsx
import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  EnvelopeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useCreateContact } from '@/lib/api/contacts';
import { toast } from '@/hooks/use-toast';
import { useTagsStore } from '@/stores/tags.store';
import { useCreateTag } from '@/lib/api/tags';
import { CustomTagSelect } from '../tag-select';

interface AddContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Tag {
  id: string;
  label: string;
  color?: string;
}

const countryCodes = [
  { code: '+263', flag: '🇿🇼', country: 'ZW' },
  { code: '+27', flag: '🇿🇦', country: 'ZA' },
  { code: '+1', flag: '🇺🇸', country: 'US' },
  { code: '+44', flag: '🇬🇧', country: 'UK' },
  { code: '+91', flag: '🇮🇳', country: 'IN' },
  { code: '+86', flag: '🇨🇳', country: 'CN' },
];

const normalizePhone = (phone: string, countryCode: string) => {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  const codeDigits = countryCode.replace('+', '');

  if (digitsOnly.startsWith(`00${codeDigits}`)) return digitsOnly.slice((`00${codeDigits}`).length);
  if (digitsOnly.startsWith(codeDigits)) return digitsOnly.slice(codeDigits.length);
  return digitsOnly.replace(/^0+/, '');
};

export const AddContactSheet = ({
  open,
  onOpenChange,
  onSuccess,
}: AddContactSheetProps) => {
  // Use Zustand store for tags
  const { 
    selectTags: availableTags, 
    isLoading: isLoadingTags,
    isLoaded: tagsLoaded 
  } = useTagsStore();
  
  const createTagMutation = useCreateTag();
  const [formData, setFormData] = useState({
    name: '',
    countryCode: '+263',
    phone: '',
    email: '',
    city: '',
    state: '',
    country: '',
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  const createContactMutation = useCreateContact();

  const selectedCountry = countryCodes.find(
    (c) => c.code === formData.countryCode
  );

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (open) {
      setIsReady(false);
      
      // Check if tags are already loaded
      if (tagsLoaded) {
        setIsReady(true);
      } else {
        // Wait for tags to load
        const checkTags = () => {
          if (tagsLoaded) {
            setIsReady(true);
          }
        };
        
        // Check immediately
        checkTags();
        
        // Also check after a short delay
        const timeout = setTimeout(checkTags, 100);
        return () => clearTimeout(timeout);
      }
    } else {
      // Reset when sheet closes
      setFormData({
        name: '',
        countryCode: '+263',
        phone: '',
        email: '',
        city: '',
        state: '',
        country: '',
      });
      setSelectedTagIds([]);
      setIsReady(false);
    }
  }, [open, tagsLoaded]);

  // Also update ready state when tags become loaded
  useEffect(() => {
    if (open && tagsLoaded && !isReady) {
      setIsReady(true);
    }
  }, [open, tagsLoaded, isReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedLocal = normalizePhone(formData.phone, formData.countryCode);
      const phone = `${formData.countryCode}${normalizedLocal}`;
      
      // Send tag IDs to backend
      const tagIds = selectedTagIds.filter(id => id);

      await createContactMutation.mutateAsync({
        ...formData,
        phone,
        tags: tagIds,
      });

      toast({
        title: 'Success',
        description: 'Contact created successfully.',
      });

      // Reset form
      setFormData({
        name: '',
        countryCode: '+263',
        phone: '',
        email: '',
        city: '',
        state: '',
        country: '',
      });
      setSelectedTagIds([]);

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contact.',
        variant: 'destructive',
      });
    }
  };

  // Function to create a new tag
  const handleCreateTag = async (label: string): Promise<Tag> => {
    try {
      // Create the tag via API
      const newTag = await createTagMutation.mutateAsync({
        name: label,
        color: getRandomColor(),
      });

      // Transform to TagSelect format
      const transformedTag: Tag = {
        id: newTag.id,
        label: newTag.name,
        color: newTag.color,
      };

      toast({
        title: 'Tag Created',
        description: `Tag "${label}" has been created.`,
      });

      return transformedTag;
    } catch (error: any) {
      console.error('Failed to create tag:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tag',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Helper to generate random color
  const getRandomColor = (): string => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Create Contact
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Name<span className="text-destructive">*</span>
            </label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter contact name"
              disabled={createContactMutation.isPending}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Phone<span className="text-destructive">*</span>
            </label>
            <div className="flex">
              <Select
                value={formData.countryCode}
                onValueChange={(value) =>
                  setFormData({ ...formData, countryCode: value })
                }
                disabled={createContactMutation.isPending}
              >
                <SelectTrigger className="w-28 rounded-r-none border-r-0">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <span>{selectedCountry?.flag}</span>
                      <span className="text-sm">{selectedCountry?.code}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border border-border">
                  {countryCodes.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.code}</span>
                        <span className="text-muted-foreground">{c.country}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, ''),
                  })
                }
                className="flex-1 rounded-l-none"
                placeholder="Phone number"
                disabled={createContactMutation.isPending}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="pl-10"
                placeholder="email@example.com"
                disabled={createContactMutation.isPending}
              />
            </div>
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                City
              </label>
              <Input
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="City"
                disabled={createContactMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                State/Region
              </label>
              <Input
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                placeholder="State/Region"
                disabled={createContactMutation.isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Country
            </label>
            <Input
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              placeholder="Country"
              disabled={createContactMutation.isPending}
            />
          </div>

          {/* Tags - Using CustomTagSelect Component */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags
            </label>
            {!isReady ? (
              <div className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Loading tags...
                </div>
              </div>
            ) : (
              <CustomTagSelect
                value={selectedTagIds}
                onChange={setSelectedTagIds}
                tags={availableTags}
                onCreateTag={handleCreateTag}
                placeholder="Select tags or create new ones..."
                disabled={createContactMutation.isPending}
                isLoading={isLoadingTags}
                maxTags={20}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createContactMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createContactMutation.isPending || !isReady}
              className="min-w-[120px]"
            >
              {createContactMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Contact'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};