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
} from '@heroicons/react/24/outline';
import { useCreateContact } from '@/lib/api/contacts';
import { toast } from '@/hooks/use-toast';

interface AddContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const countryCodes = [
  { code: '+263', flag: '🇿🇼', country: 'ZW' },
  { code: '+27', flag: '🇿🇦', country: 'ZA' },
  { code: '+1', flag: '🇺🇸', country: 'US' },
];

const availableTags = ['VIP', 'Premium', 'Active', 'New', 'Lead', 'Customer'];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'lead', label: 'Lead' },
  { value: 'customer', label: 'Customer' },
];

const normalizePhone = (phone: string) =>
  phone.replace(/^0+/, '').replace(/\s+/g, '');

export const AddContactSheet = ({
  open,
  onOpenChange,
  onSuccess,
}: AddContactSheetProps) => {
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

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  const createContactMutation = useCreateContact();

  const selectedCountry = countryCodes.find(
    (c) => c.code === formData.countryCode
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const phone = `${formData.countryCode}${normalizePhone(formData.phone)}`;

      await createContactMutation.mutateAsync({
        ...formData,
        phone,
        tags: selectedTags,
      });

      toast({
        title: 'Success',
        description: 'Contact created successfully.',
      });

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
      setSelectedTags([]);
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

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) setSelectedTags([...selectedTags, tag]);
    setTagPopoverOpen(false);
  };

  const handleRemoveTag = (tag: string) =>
    setSelectedTags(selectedTags.filter((t) => t !== tag));

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
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-48" align="start">
                <Command>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {availableTags
                      .filter((t) => !selectedTags.includes(t))
                      .map((tag) => (
                        <CommandItem
                          key={tag}
                          onSelect={() => handleAddTag(tag)}
                        >
                          {tag}
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
