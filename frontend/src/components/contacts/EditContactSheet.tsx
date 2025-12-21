// frontend/src/components/contacts/EditContactSheet.tsx
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
  XMarkIcon,
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
import { useTags } from '@/components/tags/TagsProvider';
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from '@/components/kibo-ui/tags'; // Update import path based on where Kibo UI installed it
import { CheckIcon } from 'lucide-react';

interface EditContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSuccess?: () => void;
}

interface Tag {
  id: string;
  name: string;
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

// Status configuration
const statusOptions = [
  { value: 'active', label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-200' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
  { value: 'lead', label: 'Lead', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { value: 'customer', label: 'Customer', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
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

const normalizePhone = (phone: string, countryCode: string) => {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  const codeDigits = countryCode.replace('+', '');

  if (digitsOnly.startsWith(`00${codeDigits}`)) return digitsOnly.slice((`00${codeDigits}`).length);
  if (digitsOnly.startsWith(codeDigits)) return digitsOnly.slice(codeDigits.length);
  return digitsOnly.replace(/^0+/, '');
};

export const EditContactSheet = ({ open, onOpenChange, contact, onSuccess }: EditContactSheetProps) => {
  const { data: availableTags = [] } = useTags();
  const [formData, setFormData] = useState({
    name: '',
    countryCode: '+263',
    phone: '',
    email: '',
    city: '',
    state: '',
    country: '',
    status: 'active' as string,
  });
  
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();

  useEffect(() => {
    if (!contact) {
      setSelectedTagIds([]);
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
      status: contact.status ?? 'active',
    });

    // Prefer full tag objects if present; fallback to tagIds
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

  const normalizePhone = (phone: string) =>
    phone.replace(/^0+/, '').replace(/\s+/g, '');

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!contact) return;

  try {
    // Build phone from dropdown + local input (normalize to avoid duplicate country codes)
    const normalizedLocal = normalizePhone(formData.phone, formData.countryCode);
    const fullPhone = `${formData.countryCode}${normalizedLocal}`;

    const updateData: Record<string, any> = {
      name: formData.name,
      phone: fullPhone,
      status: formData.status,
      tags: selectedTagIds, // Send array of tag IDs
    };

    // Optional fields (only send if present)
    if (formData.email?.trim()) updateData.email = formData.email.trim();
    if (formData.city?.trim()) updateData.city = formData.city.trim();
    if (formData.state?.trim()) updateData.state = formData.state.trim();
    if (formData.country?.trim()) updateData.country = formData.country.trim();

    // DEBUG: Log what we're sending
    console.log('Sending update data:', {
      contactId: contact.id,
      updateData,
      selectedTagIds,
      selectedTagDetails: selectedTagIds.map(id => ({
        id,
        name: availableTags.find(t => t.id === id)?.name
      }))
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

  const handleStatusChange = async (newStatus: string) => {
    if (!contact) return;

    setUpdatingStatus(newStatus);
    try {
      await updateContactMutation.mutateAsync({
        id: contact.id,
        updates: { status: newStatus },
      });

      setFormData(prev => ({ ...prev, status: newStatus }));

      toast({
        title: "Status Updated",
        description: `Contact status changed to ${newStatus}`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
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

  const handleTagRemove = (tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      return;
    }
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  const handleTagSelect = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      handleTagRemove(tagId);
      return;
    }
    setSelectedTagIds((prev) => [...prev, tagId]);
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
                  const value = e.target.value.replace(/\D/g, ''); // digits only
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

          {/* Status - Simple Button Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((status) => {
                const isActive = formData.status === status.value;
                const isLoading = updatingStatus === status.value;

                return (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => handleStatusChange(status.value)}
                    disabled={updateContactMutation.isPending || isLoading}
                    className={cn(
                      "relative px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                      isActive
                        ? `${status.color} border-current`
                        : "bg-secondary/50 hover:bg-secondary border-transparent",
                      (updateContactMutation.isPending || isLoading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isLoading ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      <span>{status.label}</span>
                    </div>

                    {/* Loading indicator for this specific status */}
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current status indicator */}
            <div className="mt-2 text-sm text-muted-foreground">
              Current: <span className="font-medium text-foreground">
                {statusOptions.find(s => s.value === formData.status)?.label}
              </span>
              {updatingStatus && (
                <span className="ml-2 text-xs">
                  <ArrowPathIcon className="w-3 h-3 inline animate-spin mr-1" />
                  Updating...
                </span>
              )}
            </div>
          </div>

          {/* Tags - Using Kibo UI Tags Component */}
         <div>
  <label className="block text-sm font-medium text-foreground mb-1.5">
    Tags
  </label>
  <Tags className="w-full">
    <TagsTrigger>
      {selectedTagIds.map((tagId) => {
        const tag = availableTags.find(t => t.id === tagId);
        return (
          <TagsValue 
            key={tagId} 
            onRemove={() => handleTagRemove(tagId)}
            style={tag?.color ? 
              { 
                backgroundColor: `${tag.color}20`, 
                color: tag.color,
                borderColor: tag.color 
              } : 
              undefined
            }
          >
            {tag?.name || tagId}
          </TagsValue>
        );
      })}
    </TagsTrigger>
    <TagsContent>
      <TagsInput placeholder="Search tag..." />
      <TagsList>
        <TagsEmpty>No tags found</TagsEmpty>
        <TagsGroup>
          {availableTags.map((tag) => (
            <TagsItem 
              key={tag.id} 
              onSelect={() => handleTagSelect(tag.id)} 
              value={tag.id}
            >
              <div className="flex items-center gap-2">
                {tag.color && (
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
              </div>
              {selectedTagIds.includes(tag.id) && (
                <CheckIcon className="text-muted-foreground" size={14} />
              )}
            </TagsItem>
          ))}
        </TagsGroup>
      </TagsList>
    </TagsContent>
  </Tags>
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