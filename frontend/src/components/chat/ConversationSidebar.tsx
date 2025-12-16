// frontend/src/components/chat/ConversationSidebar.tsx
import React, { useState } from 'react';
import { 
  InboxIcon, 
  TagIcon, 
  PhoneIcon, 
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  SparklesIcon,
  HashtagIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateTagDialog } from '@/components/tags/CreateTagDialog';
import { EditTagDialog } from '@/components/tags/EditTagDialog';
import { useTags, useDeleteTag } from '@/components/tags/TagsProvider';

interface ConversationSidebarProps {
  onFilterChange?: (filters: ConversationFilters) => void;
  currentUserId?: string;
  inboxCounts?: {
    all: number;
    mine: number;
    unassigned: number;
  };
}

export interface ConversationFilters {
  inboxType: string; // 'all', 'mine', 'unassigned'
  tag: string; // Tag filter
  status: string;
}

// Define inbox types without counts initially
const inboxTypes = [
  { id: 'all', label: 'All', icon: InboxIcon },
  { id: 'mine', label: 'Mine', icon: UserIcon },
  { id: 'unassigned', label: 'Unassigned', icon: TagIcon },
  { id: 'incoming_calls', label: 'Incoming Calls', icon: PhoneIcon, disabled: true },
  { id: 'ai_agent', label: 'Create AI Agent', icon: SparklesIcon, isAction: true, disabled: true },
];

const statusFilters = [
  { id: 'open', label: 'Open, Newest', icon: CheckCircleIcon },
  { id: 'unreplied', label: 'Unreplied', icon: ClockIcon },
  { id: 'closed', label: 'Closed', icon: XCircleIcon },
];

export function ConversationSidebar({ 
  onFilterChange, 
  currentUserId, 
  inboxCounts 
}: ConversationSidebarProps) {
  const [filters, setFilters] = useState<ConversationFilters>({
    inboxType: 'all',
    tag: '',
    status: 'open',
  });

  const [expandedTags, setExpandedTags] = useState(true);
  const [tagSearch, setTagSearch] = useState('');

  // Use React Query to fetch tags
  const { data: tags = [], isLoading, refetch } = useTags();
  const deleteTagMutation = useDeleteTag();

  // Create inbox types with counts inside the component
  const inboxTypesWithCounts = [
    { ...inboxTypes[0], count: inboxCounts?.all },
    { ...inboxTypes[1], count: inboxCounts?.mine },
    { ...inboxTypes[2], count: inboxCounts?.unassigned },
    ...inboxTypes.slice(3)
  ];

  // Filter tags based on search
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
    (tag.description && tag.description.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const handleFilterChange = (key: keyof ConversationFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleDeleteTag = async (tagId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent tag selection
    
    if (window.confirm('Are you sure you want to delete this tag? This will remove it from all conversations and contacts.')) {
      try {
        await deleteTagMutation.mutateAsync(tagId);
        
        // If the deleted tag was selected, clear the tag filter
        if (filters.tag === tagId) {
          handleFilterChange('tag', '');
        }
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  const handleTagCreated = (newTag: any) => {
    // Optionally auto-select the new tag
    handleFilterChange('tag', newTag.id);
    refetch(); // Refresh the tags list
  };

  const renderInboxItem = (item: typeof inboxTypesWithCounts[0]) => {
    if (item.isAction) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start px-3 py-2 h-auto rounded-lg hover:bg-secondary transition-colors text-left",
                  filters.inboxType === item.id ? "bg-primary/10 text-primary" : "text-foreground/80",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
                disabled={item.disabled}
                onClick={() => !item.disabled && handleFilterChange('inboxType', item.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <item.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </Button>
            </TooltipTrigger>
            {item.disabled && (
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        key={item.id}
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-between px-3 py-2 h-auto rounded-lg hover:bg-secondary transition-colors text-left",
          filters.inboxType === item.id ? "bg-primary/10 text-primary" : "text-foreground/80",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
        disabled={item.disabled}
        onClick={() => !item.disabled && handleFilterChange('inboxType', item.id)}
      >
        <div className="flex items-center gap-2">
          <item.icon className="w-4 h-4" />
          <span className="text-sm">{item.label}</span>
        </div>
        {item.count !== undefined && (
          <span className={cn(
            "px-1.5 py-0.5 text-xs rounded-full min-w-5 h-5 flex items-center justify-center",
            filters.inboxType === item.id 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          )}>
            {item.count}
          </span>
        )}
      </Button>
    );
  };

  const renderTagItem = (tag: any) => (
    <div key={tag.id} className="group relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-between px-3 py-1.5 h-auto rounded-lg hover:bg-secondary transition-colors text-left text-sm group",
                filters.tag === tag.id ? "bg-primary/10 text-primary" : "text-foreground/80"
              )}
              onClick={() => handleFilterChange('tag', filters.tag === tag.id ? '' : tag.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate">{tag.name}</span>
                {tag.description && (
                  <InformationCircleIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {tag.count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 text-xs rounded-full min-w-5 h-5 flex items-center justify-center",
                    filters.tag === tag.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tag.count}
                  </span>
                )}
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <EditTagDialog tag={tag} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => handleDeleteTag(tag.id, e)}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Button>
          </TooltipTrigger>
          {tag.description && (
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{tag.description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  const renderStatusItem = (item: typeof statusFilters[0]) => (
    <Button
      key={item.id}
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start px-3 py-2 h-auto rounded-lg hover:bg-secondary transition-colors text-left",
        filters.status === item.id ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
      )}
      onClick={() => handleFilterChange('status', item.id)}
    >
      <div className="flex items-center gap-2">
        <item.icon className="w-4 h-4" />
        <span className="text-sm">{item.label}</span>
      </div>
    </Button>
  );

  return (
    <aside className="w-64 border-r border-border bg-card h-full overflow-y-auto flex-shrink-0">
      {/* Inbox Section */}
      <div className="p-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Inbox</h2>
        <div className="space-y-0.5">
          {inboxTypesWithCounts.map(renderInboxItem)}
        </div>
      </div>

      {/* Divider */}
      <div className="px-3 py-2">
        <div className="border-t border-border" />
      </div>

      {/* Tags Section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Tags</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpandedTags(!expandedTags)}
          >
            {expandedTags ? (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronRightIcon className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        
        {expandedTags && (
          <>
            {/* Tag Search */}
            <div className="relative mb-2">
              <Input
                type="text"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="pl-3 pr-8 h-8 text-sm"
              />
              <HashtagIcon className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {/* Tags List */}
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">Loading tags...</p>
                </div>
              ) : filteredTags.length > 0 ? (
                <>
                  {filteredTags.map(renderTagItem)}
                  
                  {/* Clear Tag Filter */}
                  {filters.tag && (
                    <div className="pt-1 border-t border-border/50 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start px-3 py-1.5 h-auto rounded-lg hover:bg-secondary transition-colors text-left text-sm text-primary"
                        onClick={() => handleFilterChange('tag', '')}
                      >
                        Clear tag filter
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">
                    {tagSearch ? 'No tags found' : 'No tags yet'}
                  </p>
                </div>
              )}
            </div>

            {/* Create New Tag Button */}
            <CreateTagDialog
              onSuccess={handleTagCreated}
              variant="ghost"
              size="sm"
              className="w-full justify-start px-3 py-1.5 mt-2 h-auto text-xs text-primary hover:text-primary-hover hover:bg-primary/5"
            />
          </>
        )}
      </div>

      {/* Divider */}
      <div className="px-3 py-2">
        <div className="border-t border-border" />
      </div>

      {/* Status Section */}
      <div className="p-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Status</h2>
        <div className="space-y-0.5">
          {statusFilters.map(renderStatusItem)}
        </div>
      </div>
    </aside>
  );
}