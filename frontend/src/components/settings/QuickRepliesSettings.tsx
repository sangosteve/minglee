
// frontend/src/components/settings/QuickRepliesSettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  EllipsisVerticalIcon, 
  DocumentTextIcon,
  ArrowsUpDownIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CreateSnippetDialog } from './CreateSnippetDialog';
import { EditSnippetDialog } from './EditSnippetDialog';
import { useQuickReplies, useDeleteQuickReply, useDuplicateQuickReply } from '@/hooks/use-quick-replies';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuickReply } from '@/lib/api/quick-replies';

export function QuickRepliesSettings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use the real data from API - SIMPLIFIED FILTERS LIKE CONVERSATIONS
  const { data, isLoading, refetch } = useQuickReplies({
    page: 1,
    limit: 100,
    isActive: true,
  });

  // Debug: Log the data
  useEffect(() => {
    console.log('QuickRepliesSettings Data:', data);
  }, [data]);

  const deleteQuickReply = useDeleteQuickReply();
  const duplicateQuickReply = useDuplicateQuickReply();

  // Filter quick replies CLIENT-SIDE based on search and topic
  const filteredQuickReplies = React.useMemo(() => {
    if (!data?.quickReplies) return [];
    
    let filtered = data.quickReplies;
    
    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(reply => 
        reply.name.toLowerCase().includes(searchLower) ||
        reply.message.toLowerCase().includes(searchLower) ||
        reply.topics.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply topic filter
    if (topicFilter !== 'all') {
      filtered = filtered.filter(reply => 
        reply.topics.toLowerCase().includes(topicFilter.toLowerCase())
      );
    }
    
    return filtered;
  }, [data?.quickReplies, debouncedSearch, topicFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteQuickReply.mutateAsync(id);
        toast({
          title: "Success",
          description: "Quick reply deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete quick reply",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleDuplicate = async (id: string, name: string) => {
    try {
      await duplicateQuickReply.mutateAsync(id);
      toast({
        title: "Success",
        description: `"${name}" duplicated successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate quick reply",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingQuickReply(reply);
    setEditDialogOpen(true);
  };

  const handleSnippetCreated = () => {
    refetch();
  };

  const handleEditSuccess = () => {
    refetch();
    setEditDialogOpen(false);
    setEditingQuickReply(null);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Get file display with links
  const getFilesDisplay = (reply: QuickReply) => {
    // Check both possible locations for media attachments
    const mediaAttachments = reply.mediaAttachments || [];
    const mediaAttachmentIds = reply.mediaAttachmentIds || [];
    
    // Combine both sources
    const allMedia = [...mediaAttachments];
    
    if (!allMedia.length && mediaAttachmentIds.length > 0) {
      // If we only have IDs, show count
      return (
        <div className="flex items-center gap-1">
          <PaperClipIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {mediaAttachmentIds.length} file{mediaAttachmentIds.length > 1 ? 's' : ''}
          </span>
        </div>
      );
    }

    // If we have media attachment objects
    if (allMedia.length > 0) {
      return (
        <div className="space-y-1">
          {allMedia.slice(0, 2).map((attachment: any, index: number) => (
            <div key={index} className="flex items-center gap-1">
              <PaperClipIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <a
                href={attachment.secureUrl || attachment.cloudinaryUrl || attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline truncate max-w-[120px]"
                title={attachment.filename || attachment.originalFilename || `Attachment ${index + 1}`}
              >
                {attachment.filename || attachment.originalFilename || `Attachment ${index + 1}`}
              </a>
            </div>
          ))}
          {allMedia.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{allMedia.length - 2} more
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <DocumentTextIcon className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Quick Replies</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create canned responses to be used in Inbox, Broadcasts, and Workflows.
          </p>
        </div>
        
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Extract quick replies from data
  const quickReplies = data?.quickReplies || [];
  const totalCount = quickReplies.length;
  const filteredCount = filteredQuickReplies.length;

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <DocumentTextIcon className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Quick Replies</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create canned responses to be used in Inbox, Broadcasts, and Workflows.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <CreateSnippetDialog onSuccess={handleSnippetCreated} />

          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search Quick Replies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 bg-background border-input"
              />
            </div>
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="w-40 bg-background border-input">
                <SelectValue placeholder="Filter by Topic" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Topics</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Customer Service">Customer Service</SelectItem>
                <SelectItem value="Technical">Technical</SelectItem>
                <SelectItem value="Billing">Billing</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="Greeting">Greeting</SelectItem>
                <SelectItem value="FAQ">FAQ</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              className="border-input"
              onClick={() => refetch()}
            >
              <DocumentTextIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-64">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Name
                    <ArrowsUpDownIcon className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="min-w-64">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Message
                    <ArrowsUpDownIcon className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Topics</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Status
                    <ArrowsUpDownIcon className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Date Added
                    <ArrowsUpDownIcon className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuickReplies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <DocumentTextIcon className="w-12 h-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No quick replies found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery || topicFilter !== 'all' 
                          ? 'Try a different search term or filter' 
                          : 'Create your first quick reply'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuickReplies.map((reply: QuickReply) => (
                  <TableRow key={reply.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col">
                        <span>{reply.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md">
                      <div className="line-clamp-2">{reply.message}</div>
                    </TableCell>
                    <TableCell>
                      {getFilesDisplay(reply)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {reply.topics}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        reply.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {reply.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(reply.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <EllipsisVerticalIcon className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border w-48">
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            onClick={() => handleEdit(reply)}
                          >
                            <PencilIcon className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            onClick={() => handleDuplicate(reply.id, reply.name)}
                          >
                            <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => handleDelete(reply.id, reply.name)}
                          >
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination/Count Info */}
        {filteredQuickReplies.length > 0 && (
          <div className="flex items-center justify-between gap-4 mt-4 text-sm text-muted-foreground">
            <div>
              Showing {filteredCount} of {totalCount} quick replies
              {(searchQuery || topicFilter !== 'all') && (
                <span className="text-primary ml-2">
                  (filtered)
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select defaultValue="25" disabled>
                  <SelectTrigger className="w-16 h-8 bg-background border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span>Showing all (client-side filtered)</span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingQuickReply && (
        <EditSnippetDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          quickReply={editingQuickReply}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}