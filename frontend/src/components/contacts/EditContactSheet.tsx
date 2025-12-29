// frontend/src/components/contacts/EditContactSheet.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  EnvelopeIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateContact, useDeleteContact } from '@/lib/api/contacts';
import { toast } from '@/hooks/use-toast';
import type { Contact } from '@/lib/api/contacts';
import { cn } from '@/lib/utils';
import { TagSelect } from '@/components/tag-select';
import { tagsApi } from '@/lib/api/tags';

interface EditContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSuccess?: () => void;
}

interface Tag {
  id: string;
  label: string;
  color?: string;
}

const countryCodes = [
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+263', country: 'ZW', flag: '🇿🇼' },
  { code: '+27', country: 'ZA', flag: '🇿🇦' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+65', country: 'SG', flag: '🇸🇬' },
];

const parsePhoneNumber = (phone: string) => {
  if (!phone) return { countryCode: '+263', phoneNumber: '' };
  const clean = phone.replace(/\s+/g, '');

  for (const c of countryCodes) {
    const code = c.code; // e.g. '+263'
    const digits = code.replace('+', ''); // '263'

    if (clean.startsWith(code)) {
      return { countryCode: code, phoneNumber: clean.slice(code.length) };
    }

    if (clean.startsWith(digits)) {
      return { countryCode: `+${digits}`, phoneNumber: clean.slice(digits.length) };
    }

    if (clean.startsWith(`00${digits}`)) {
      return { countryCode: `+${digits}`, phoneNumber: clean.slice((`00${digits}`).length) };
    }
  }

  // Fallback: strip leading zeros for national format
  return { countryCode: '+263', phoneNumber: clean.replace(/^0+/, '') };
};

export const EditContactSheet = ({ open, onOpenChange, contact, onSuccess }: EditContactSheetProps) => {
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
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();

  // Fetch available tags
  useEffect(() => {
    if (open) {
      fetchTags();
    }
  }, [open]);

  const fetchTags = async () => {
    setIsLoadingTags(true);
    try {
      const tagsData = await tagsApi.getAll();
      // Transform the API response to match TagSelect format
      const transformedTags: Tag[] = tagsData.map(tag => ({
        id: tag.id,
        label: tag.name,
        color: tag.color,
      }));
      setAvailableTags(transformedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tags',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTags(false);
    }
  };

  // Reset form when contact changes
  useEffect(() => {
    if (!contact) {
      setSelectedTagIds([]);
      setFormData({
        name: '',
        countryCode: '+263',
        phone: '',
        email: '',
        city: '',
        state: '',
        country: '',
      });
      return;
    }

    const { countryCode, phoneNumber } = parsePhoneNumber(contact.phone ?? '');

    setFormData({
      name: contact.name ?? '',
      countryCode,
      phone: phoneNumber,
      email: contact.email ?? '',
      city: contact.city ?? '',
      state: contact.state ?? '',
      country: contact.country ?? '',
    });

    // Extract tag IDs from contact
    if (contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0) {
      if (typeof contact.tags[0] === 'object') {
        setSelectedTagIds(contact.tags.map((tag: any) => tag.id));
      } else {
        setSelectedTagIds(contact.tags as string[]);
      }
    } else if (contact.tagIds && Array.isArray(contact.tagIds) && contact.tagIds.length > 0) {
      setSelectedTagIds(contact.tagIds as string[]);
    } else {
      setSelectedTagIds([]);
    }
  }, [contact?.id, contact?.tagIds?.length, contact?.tags?.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    try {
      // Build phone from dropdown + local input
      const normalizedLocal = formData.phone.replace(/^0+/, '').replace(/\s+/g, '');
      const fullPhone = `${formData.countryCode}${normalizedLocal}`;

      const updateData: Record<string, any> = {
        name: formData.name,
        phone: fullPhone,
        tagIds: selectedTagIds, // Send array of tag IDs
      };

      // Optional fields (only send if present)
      if (formData.email?.trim()) updateData.email = formData.email.trim();
      if (formData.city?.trim()) updateData.city = formData.city.trim();
      if (formData.state?.trim()) updateData.state = formData.state.trim();
      if (formData.country?.trim()) updateData.country = formData.country.trim();

      console.log('Sending update data:', {
        contactId: contact.id,
        updateData,
        selectedTagIds,
      });

      await updateContactMutation.mutateAsync({
        id: contact.id,
        updates: updateData,
      });

      toast({
        title: 'Success',
        description: 'Contact updated successfully.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update contact.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!contact) return;

    if (window.confirm("Are you sure you want to delete this contact?")) {
      try {
        await deleteContactMutation.mutateAsync(contact.id);

        toast({
          title: "Success",
          description: "Contact deleted successfully.",
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete contact.",
          variant: "destructive",
        });
      }
    }
  };

  // Function to create a new tag
  const handleCreateTag = async (label: string): Promise<Tag> => {
    try {
      // Create the tag via API
      const newTag = await tagsApi.create({
        name: label,
        color: getRandomColor(),
      });

      // Transform to TagSelect format
      const transformedTag: Tag = {
        id: newTag.id,
        label: newTag.name,
        color: newTag.color,
      };

      // Update local tags list
      setAvailableTags(prev => [...prev, transformedTag]);

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

  const selectedCountry = countryCodes.find((c) => c.code === formData.countryCode);

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-semibold text-foreground">
              Edit Contact
            </SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={updateContactMutation.isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleteContactMutation.isPending ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <TrashIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Name<span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter the name"
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              disabled={updateContactMutation.isPending}
            />
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Phone<span className="text-destructive">*</span>
            </label>
            <div className="flex">
              <Select
                value={formData.countryCode}
                onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                disabled={updateContactMutation.isPending}
              >
                <SelectTrigger className="w-24 rounded-r-none border-r-0">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <span>{selectedCountry?.flag}</span>
                      <span className="text-sm">{selectedCountry?.code}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border border-border z-50">
                  {countryCodes.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.code}</span>
                        <span className="text-muted-foreground">{country.country}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, phone: value });
                }}
                placeholder="Phone number"
                className="flex-1 px-4 py-2.5 border border-border rounded-r-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={updateContactMutation.isPending}
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={updateContactMutation.isPending}
              />
            </div>
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={updateContactMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                State/Region
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State/Region"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                disabled={updateContactMutation.isPending}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Country
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="Country"
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              disabled={updateContactMutation.isPending}
            />
          </div>

          {/* Tags Section - Using Custom TagSelect Component */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags
            </label>
            <TagSelect
              value={selectedTagIds}
              onChange={setSelectedTagIds}
              tags={availableTags}
              onCreateTag={handleCreateTag}
              placeholder="Select tags or create new ones..."
              disabled={updateContactMutation.isPending}
              isLoading={isLoadingTags}
              maxTags={20}
            />
            <div className="mt-2 text-xs text-muted-foreground flex justify-between">
              <span>
                {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''} selected
              </span>
              {availableTags.length === 0 && (
                <span>Type a name and press Enter to create a new tag</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateContactMutation.isPending || deleteContactMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateContactMutation.isPending || deleteContactMutation.isPending}
              className="min-w-[100px]"
            >
              {updateContactMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};