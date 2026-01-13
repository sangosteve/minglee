// frontend/src/components/contacts/BulkActionsToolbar.tsx
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  TagIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useContactsStore } from '@/stores/contacts.store';

interface BulkActionsToolbarProps {
  visible: boolean;
  totalContacts: number;
  selectedCount: number;
  onImportClick: () => void;
  onExportClick: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export const BulkActionsToolbar = ({
  visible,
  totalContacts,
  selectedCount,
  onImportClick,
  onExportClick,
  onBulkDelete,
  onClearSelection,
}: BulkActionsToolbarProps) => {
  const { selectAllContacts } = useContactsStore();

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg px-4 py-3 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedCount === totalContacts}
            onCheckedChange={() => selectAllContacts(
              Array.from({ length: totalContacts }, (_, i) => `temp-${i}`)
            )}
          />
          <span className="text-sm font-medium">
            {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onExportClick}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onImportClick}
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowsPointingOutIcon className="w-4 h-4" />
                More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {}} className="gap-2">
                <TagIcon className="w-4 h-4" />
                Add tags
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}} className="gap-2">
                <TagIcon className="w-4 h-4" />
                Remove tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onBulkDelete}
                className="gap-2 text-destructive"
              >
                <TrashIcon className="w-4 h-4" />
                Delete selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            <XMarkIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};