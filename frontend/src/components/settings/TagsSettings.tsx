import React, { useState } from 'react';
import { Tag, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateTagDialog } from '@/components/tags/CreateTagDialog';
import { EditTagDialog } from '@/components/tags/EditTagDialog';
import { useTags, useDeleteTag } from '@/components/tags/TagsProvider';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Tag as TagType } from '@/lib/api/tags';

export function TagsSettings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Use real data from API
  const { data: tags = [], isLoading, refetch } = useTags();
  
  const deleteTagMutation = useDeleteTag();

  const handleDelete = async (tag: TagType) => {
    if (window.confirm(`Are you sure you want to delete "${tag.name}"?`)) {
      try {
        await deleteTagMutation.mutateAsync(tag.id);
        toast({
          title: "Success",
          description: "Tag deleted successfully",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete tag",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setEditDialogOpen(true);
  };

  const handleTagCreated = (newTag: TagType) => {
    refetch();
    toast({
      title: "Success",
      description: `"${newTag.name}" created successfully`,
    });
  };

  const handleTagUpdated = (updatedTag: TagType) => {
    refetch();
    setEditDialogOpen(false);
    setEditingTag(null);
    toast({
      title: "Success",
      description: `"${updatedTag.name}" updated successfully`,
    });
  };

  // Filter tags based on search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tag.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header skeleton */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="mt-4 max-w-md">
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Tags list skeleton */}
        <ScrollArea className="flex-1 p-6">
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-40 mt-1" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Format color for background with opacity
  const getColorStyle = (color: string) => ({
    backgroundColor: `${color}20`,
    color: color,
  });

  return (
    <>
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Tags</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage tags to organize your conversations and contacts
              </p>
            </div>
            <CreateTagDialog onSuccess={handleTagCreated} />
          </div>

          {/* Search */}
          <div className="mt-4 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tags by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tags List */}
        <ScrollArea className="flex-1 p-6">
          <div className="grid gap-3">
            {filteredTags.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No tags found' : 'No tags yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'Try a different search term' : 'Create your first tag to get started'}
                </p>
              </div>
            ) : (
              filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={getColorStyle(tag.color)}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{tag.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {tag.count || 0} items
                        </Badge>
                      </div>
                      {tag.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {tag.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(tag.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(tag)}
                      disabled={deleteTagMutation.isPending}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tag)}
                      disabled={deleteTagMutation.isPending}
                    >
                      {deleteTagMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit Dialog */}
      {editingTag && (
        <EditTagDialog
          tag={editingTag}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleTagUpdated}
        />
      )}
    </>
  );
}