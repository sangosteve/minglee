// frontend/src/components/contacts/AddContactSheet.tsx
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EnvelopeIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useCreateContact } from '@/lib/api/contacts';
import { toast } from '@/hooks/use-toast';
import { useTags } from '@/components/tags/TagsProvider';
import { cn } from '@/lib/utils';

interface AddContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}

const countryCodes = [
  { code: '+263', flag: '🇿🇼', country: 'ZW' },
  { code: '+27', flag: '🇿🇦', country: 'ZA' },
  { code: '+1', flag: '🇺🇸', country: 'US' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'lead', label: 'Lead' },
  { value: 'customer', label: 'Customer' },
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
  const { data: availableTags = [] } = useTags();
  const [formData, setFormData] = useState({
    name: '',
    countryCode: '+263',
    phone: '',
    email: '',
    city: '',
    state: '',
    country: '',
    status: 'active',
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  const createContactMutation = useCreateContact();

  const selectedCountry = countryCodes.find(
    (c) => c.code === formData.countryCode
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedLocal = normalizePhone(formData.phone, formData.countryCode);
      const phone = `${formData.countryCode}${normalizedLocal}`;
      
      // Send tag IDs to backend
      const tagIds = selectedTagIds.filter(id => id); // Filter out any empty IDs

      await createContactMutation.mutateAsync({
        ...formData,
        phone,
        tags: tagIds, // Send array of tag IDs
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
        status: 'active',
      });
      setSelectedTagIds([]);
      setTagPopoverOpen(false);

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

  const handleAddTag = (tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
    setTagPopoverOpen(false);
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
  };

  // Get selected tag objects for display
  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Create Contact</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Name<span className="text-destructive">*</span>
            </label>
            <input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2.5 border rounded-lg"
              placeholder="Enter contact name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Phone<span className="text-destructive">*</span>
            </label>
            <div className="flex">
              <Select
                value={formData.countryCode}
                onValueChange={(value) =>
                  setFormData({ ...formData, countryCode: value })
                }
              >
                <SelectTrigger className="w-28 rounded-r-none border-r-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countryCodes.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, ''),
                  })
                }
                className="flex-1 px-4 py-2.5 border rounded-r-lg"
                placeholder="Phone number"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">City</label>
              <input
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full px-4 py-2.5 border rounded-lg"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                State/Region
              </label>
              <input
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                className="w-full px-4 py-2.5 border rounded-lg"
                placeholder="State/Region"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Country</label>
            <input
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              className="w-full px-4 py-2.5 border rounded-lg"
              placeholder="Country"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags</label>
            
            {/* Selected Tags Display */}
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTags.map((tag) => (
                <Badge 
                  key={tag.id} 
                  variant="secondary"
                  style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-1 hover:opacity-70"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {/* Tags Popover */}
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={createContactMutation.isPending}
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Tags
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-48" align="start">
                <Command>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {availableTags
                      .filter((tag) => !selectedTagIds.includes(tag.id))
                      .map((tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => handleAddTag(tag.id)}
                          className="flex items-center justify-between"
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
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createContactMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createContactMutation.isPending}>
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