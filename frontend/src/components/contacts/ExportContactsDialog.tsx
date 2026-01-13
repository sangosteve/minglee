// frontend/src/components/contacts/ExportContactsDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { generateCSV, downloadCSV } from '@/lib/contacts-utils';
import type { Contact } from '@/lib/api/contacts';
import { useContactsStore } from '@/stores/contacts.store';
import { useContacts } from '@/lib/api/contacts';

interface ExportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportContactsDialog = ({
  open,
  onOpenChange,
}: ExportContactsDialogProps) => {
  const { selectedContactIds, clearSelection } = useContactsStore();
  const [exportOption, setExportOption] = useState<'all' | 'selected' | 'filtered'>('selected');
  const [fields, setFields] = useState({
    name: true,
    phone: true,
    email: true,
    city: true,
    state: true,
    country: true,
    status: true,
    tags: true,
    createdAt: true,
  });

  const { data: contactsData } = useContacts({});
  const allContacts = contactsData?.contacts || [];

  const handleExport = () => {
    let contactsToExport: Contact[] = [];

    switch (exportOption) {
      case 'all':
        contactsToExport = allContacts;
        break;
      case 'selected':
        contactsToExport = allContacts.filter(contact => 
          selectedContactIds.includes(contact.id)
        );
        break;
      case 'filtered':
        // In a real app, you would use the current filter state
        contactsToExport = allContacts;
        break;
    }

    if (contactsToExport.length === 0) {
      alert('No contacts to export');
      return;
    }

    // Filter fields based on selection
    const filteredContacts = contactsToExport.map(contact => ({
      ...contact,
      // If tags field is selected, ensure it's in the right format
      tags: fields.tags ? contact.tags : undefined,
    }));

    const csvContent = generateCSV(filteredContacts);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `contacts-${timestamp}.csv`);
    
    toast({
      title: 'Export successful',
      description: `Exported ${filteredContacts.length} contacts`,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Contacts</DialogTitle>
          <DialogDescription>
            Choose which contacts and fields to export as CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup value={exportOption} onValueChange={(value: any) => setExportOption(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="selected" id="selected" />
              <Label htmlFor="selected">
                Selected contacts ({selectedContactIds.length})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">
                All contacts ({allContacts.length})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="filtered" id="filtered" />
              <Label htmlFor="filtered">
                Current filtered view
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-3">
            <Label>Fields to include</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) =>
                      setFields(prev => ({ ...prev, [key]: checked as boolean }))
                    }
                  />
                  <Label htmlFor={key} className="text-sm capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Export format:</p>
            <p>CSV (comma-separated values) - Compatible with Excel, Google Sheets, and other spreadsheet software</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="gap-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};