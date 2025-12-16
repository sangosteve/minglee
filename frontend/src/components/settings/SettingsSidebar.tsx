import React from 'react';
import { 
  InformationCircleIcon, 
  UserIcon, 
  UsersIcon, 
  ChatBubbleLeftRightIcon, 
  LinkIcon, 
  PuzzlePieceIcon, 
  UserPlusIcon,
  IdentificationIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  TagIcon,
  SparklesIcon,
  CommandLineIcon,
  PhoneIcon,
  FolderOpenIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type SettingsSection = 
  | 'general-info'
  | 'user-settings' 
  | 'team-settings'
  | 'channels'
  | 'integrations'
  | 'growth-widgets'
  | 'contact-fields'
  | 'lifecycle'
  | 'closing-notes'
  | 'quick-replies'
  | 'tags'
  | 'ai-assist'
  | 'ai-prompts'
  | 'calls'
  | 'files'
  | 'contacts-import'
  | 'data-export';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

interface SettingsItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  badge?: string;
  disabled?: boolean;
}

interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

const settingsGroups: SettingsGroup[] = [
  {
    title: 'General settings',
    items: [
      { id: 'general-info', label: 'General info', icon: InformationCircleIcon, disabled: true },
    ],
  },
  {
    title: 'User role settings',
    items: [
      { id: 'user-settings', label: 'User settings', icon: UserIcon, disabled: true },
      { id: 'team-settings', label: 'Team settings', icon: UsersIcon, disabled: true },
    ],
  },
  {
    title: 'Apps',
    items: [
      { id: 'channels', label: 'Channels', icon: ChatBubbleLeftRightIcon, disabled: true },
      { id: 'integrations', label: 'Integrations', icon: LinkIcon, disabled: true },
      { id: 'growth-widgets', label: 'Growth widgets', icon: PuzzlePieceIcon, disabled: true },
    ],
  },
  {
    title: 'Inbox settings',
    items: [
      { id: 'contact-fields', label: 'Contact fields', icon: IdentificationIcon, disabled: true },
      { id: 'lifecycle', label: 'Lifecycle', icon: ArrowPathIcon, disabled: true },
      { id: 'closing-notes', label: 'Closing notes', icon: ClipboardDocumentCheckIcon, disabled: true },
      { id: 'quick-replies', label: 'quick-replies', icon: DocumentTextIcon },
      { id: 'tags', label: 'Tags', icon: TagIcon },
      { id: 'ai-assist', label: 'AI Assist', icon: SparklesIcon, disabled: true },
      { id: 'ai-prompts', label: 'AI Prompts', icon: CommandLineIcon, disabled: true },
      { id: 'calls', label: 'Calls', icon: PhoneIcon, badge: 'New', disabled: true },
    ],
  },
  {
    title: 'Data settings',
    items: [
      { id: 'files', label: 'Files', icon: FolderOpenIcon, disabled: true },
      { id: 'contacts-import', label: 'Contacts import', icon: ArrowUpTrayIcon, disabled: true },
      { id: 'data-export', label: 'Data export', icon: ArrowDownTrayIcon, disabled: true },
    ],
  },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <aside className="w-56 border-r border-border bg-card h-full overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="p-4 pb-2">
        <h2 className="text-sm font-semibold text-foreground">Workspace settings</h2>
      </div>

      {/* Navigation Groups */}
      <nav className="px-3 pb-4">
        {settingsGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-1 px-2">
              {group.title}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  disabled={item.disabled}
                  className={cn(
                    "w-full justify-start px-2 py-1.5 h-8 rounded-md text-sm font-normal transition-colors",
                    activeSection === item.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    item.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !item.disabled && onSectionChange(item.id)}
                >
                  <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
