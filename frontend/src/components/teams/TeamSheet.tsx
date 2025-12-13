import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  color: string;
  members: TeamMember[];
  createdAt: string;
}

interface TeamSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  mode: 'create' | 'edit';
  availableMembers: TeamMember[];
  onSave: (team: Partial<Team>) => void;
  onDelete?: (teamId: number) => void;
}

const teamColors = [
  { name: 'Indigo', value: 'bg-primary' },
  { name: 'Green', value: 'bg-crm-success' },
  { name: 'Orange', value: 'bg-crm-warning' },
  { name: 'Red', value: 'bg-destructive' },
  { name: 'Purple', value: 'bg-purple-500' },
  { name: 'Blue', value: 'bg-blue-500' },
];

export const TeamSheet = ({
  open,
  onOpenChange,
  team,
  mode,
  availableMembers,
  onSave,
  onDelete,
}: TeamSheetProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'bg-primary',
  });
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    if (team && mode === 'edit') {
      setFormData({
        name: team.name,
        description: team.description,
        color: team.color,
      });
      setSelectedMembers(team.members);
    } else {
      setFormData({
        name: '',
        description: '',
        color: 'bg-primary',
      });
      setSelectedMembers([]);
    }
  }, [team, mode, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      members: selectedMembers,
      id: team?.id,
    });
    onOpenChange(false);
  };

  const handleAddMember = (member: TeamMember) => {
    if (!selectedMembers.find((m) => m.id === member.id)) {
      setSelectedMembers([...selectedMembers, member]);
    }
    setShowMemberDropdown(false);
  };

  const handleRemoveMember = (memberId: number) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
  };

  const handleDelete = () => {
    if (team && onDelete && window.confirm('Are you sure you want to delete this team?')) {
      onDelete(team.id);
      onOpenChange(false);
    }
  };

  const unassignedMembers = availableMembers.filter(
    (m) => !selectedMembers.find((sm) => sm.id === m.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-semibold text-foreground">
              {mode === 'create' ? 'Create Team' : 'Edit Team'}
            </SheetTitle>
            {mode === 'edit' && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Team Name<span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter team name"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter team description"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Team Color */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Team Color</label>
            <div className="flex gap-2 flex-wrap">
              {teamColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full ${color.value} transition-all ${
                    formData.color === color.value
                      ? 'ring-2 ring-offset-2 ring-primary ring-offset-background'
                      : 'hover:scale-110'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Team Members */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Team Members</label>
            <p className="text-sm text-muted-foreground">
              Add members to this team
            </p>

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2 mt-3">
                {selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {member.avatar}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1 hover:bg-destructive/10 rounded-full transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Member Dropdown */}
            <div className="relative mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                className="gap-1.5"
                disabled={unassignedMembers.length === 0}
              >
                <PlusIcon className="w-4 h-4" />
                Add member
              </Button>

              {showMemberDropdown && unassignedMembers.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                  {unassignedMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleAddMember(member)}
                      className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {member.avatar}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
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
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === 'create' ? 'Create Team' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
