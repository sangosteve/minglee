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
  PlusIcon,
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

interface EditContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSuccess?: () => void;
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

const availableTags = ['VIP', 'Premium', 'Active', 'New', 'Lead', 'Customer'];

// Status configuration
const statusOptions = [
  { value: 'active', label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-200' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
  { value: 'lead', label: 'Lead', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { value: 'customer', label: 'Customer', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
];

const parsePhoneNumber = (phone: string) => {
  const match = countryCodes.find(c => phone.startsWith(c.code));

  if (!match) {
    return {
      countryCode: '+263',
      phoneNumber: phone,
    };
  }

  return {
    countryCode: match.code,
    phoneNumber: phone.slice(match.code.length),
  };
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
    status: 'active' as string,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();

  useEffect(() => {
    if (!contact) return;

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

    setSelectedTags(contact.tags ?? []);
  }, [contact?.id]);

  const normalizePhone = (phone: string) =>
    phone.replace(/^0+/, '').replace(/\s+/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    try {
      // ✅ Build phone ONLY from dropdown + local input
      const fullPhone = `${formData.countryCode}${normalizePhone(formData.phone)}`;

      const updateData: Record<string, any> = {
        name: formData.name,
        phone: fullPhone,
        status: formData.status,
        tags: selectedTags,
      };

      // Optional fields (only send if present)
      if (formData.email?.trim()) updateData.email = formData.email.trim();
      if (formData.city?.trim()) updateData.city = formData.city.trim();
      if (formData.state?.trim()) updateData.state = formData.state.trim();
      if (formData.country?.trim()) updateData.country = formData.country.trim();

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

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setShowTagDropdown(false);
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
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

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags
            </label>
            <p className="text-sm text-muted-foreground mb-2">Contact Tags</p>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={updateContactMutation.isPending}
                      className="hover:bg-primary/20 rounded-full p-0.5 disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add Tag Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                disabled={updateContactMutation.isPending}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
              >
                <PlusIcon className="w-4 h-4" />
                Add tag
              </button>

              {showTagDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  {availableTags
                    .filter((tag) => !selectedTags.includes(tag))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
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