import React, { useState } from 'react';
import { Tag, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data - replace with actual API calls
const mockTags = [
  { id: '1', name: 'VIP', color: '#22c55e', description: 'High priority customers', count: 24 },
  { id: '2', name: 'Support', color: '#3b82f6', description: 'Support related conversations', count: 156 },
  { id: '3', name: 'Sales', color: '#f59e0b', description: 'Sales inquiries', count: 89 },
  { id: '4', name: 'Urgent', color: '#ef4444', description: 'Requires immediate attention', count: 12 },
  { id: '5', name: 'Follow-up', color: '#8b5cf6', description: 'Needs follow-up', count: 45 },
];

export function TagsSettings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tags] = useState(mockTags);

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
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
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Tag
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tags..."
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
                    style={{ backgroundColor: `${tag.color}20` }}
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
                        {tag.count} items
                      </Badge>
                    </div>
                    {tag.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {tag.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
