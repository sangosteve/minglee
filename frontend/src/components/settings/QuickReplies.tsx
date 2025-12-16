// frontend/src/components/settings/sections/QuickReplies.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  ClipboardDocumentIcon,
  BoltIcon,
  TagIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuickReply {
  id: string;
  title: string;
  message: string;
  shortcut: string;
  tags: string[];
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
}

interface QuickRepliesProps {
  user?: any;
}

export const QuickReplies: React.FC<QuickRepliesProps> = ({ user }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  const [formData, setFormData] = useState<Omit<QuickReply, 'id' | 'usageCount' | 'createdAt' | 'lastUsed'>>({
    title: '',
    message: '',
    shortcut: '',
    tags: []
  });

  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    {
      id: '1',
      title: 'Welcome Message',
      message: 'Hello! Thanks for reaching out. How can I help you today? 😊',
      shortcut: '/welcome',
      tags: ['greeting', 'welcome'],
      usageCount: 42,
      lastUsed: '2024-01-20',
      createdAt: '2024-01-01'
    },
    {
      id: '2',
      title: 'Business Hours',
      message: 'Our business hours are Monday-Friday, 9AM-6PM. We\'ll respond to your message during these hours.',
      shortcut: '/hours',
      tags: ['info', 'hours'],
      usageCount: 28,
      lastUsed: '2024-01-19',
      createdAt: '2024-01-02'
    },
    {
      id: '3',
      title: 'Price Inquiry',
      message: 'Thanks for your interest! Could you share more details about what you\'re looking for so I can provide accurate pricing?',
      shortcut: '/price',
      tags: ['sales', 'pricing'],
      usageCount: 31,
      lastUsed: '2024-01-18',
      createdAt: '2024-01-03'
    },
    {
      id: '4',
      title: 'Appointment Confirmation',
      message: 'Great! Your appointment has been confirmed for {date} at {time}. See you then!',
      shortcut: '/confirm',
      tags: ['appointments', 'confirmation'],
      usageCount: 19,
      lastUsed: '2024-01-17',
      createdAt: '2024-01-04'
    },
    {
      id: '5',
      title: 'Follow Up',
      message: 'Just checking in on our previous conversation. Is there anything else I can help with?',
      shortcut: '/followup',
      tags: ['followup', 'checkin'],
      usageCount: 15,
      lastUsed: '2024-01-16',
      createdAt: '2024-01-05'
    }
  ]);

  const allTags = Array.from(new Set(quickReplies.flatMap(reply => reply.tags)));

  const handleCreateOrUpdate = () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Missing required fields",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      // Update existing
      setQuickReplies(prev => prev.map(reply => 
        reply.id === editingId 
          ? { ...reply, ...formData }
          : reply
      ));
      toast({
        title: "Quick reply updated",
        description: "Your quick reply has been updated successfully",
      });
      setEditingId(null);
    } else {
      // Create new
      const newQuickReply: QuickReply = {
        id: Date.now().toString(),
        ...formData,
        usageCount: 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setQuickReplies([...quickReplies, newQuickReply]);
      toast({
        title: "Quick reply created",
        description: "Your new quick reply is ready to use",
      });
    }

    // Reset form
    setFormData({
      title: '',
      message: '',
      shortcut: '',
      tags: []
    });
    setIsCreating(false);
  };

  const handleEdit = (reply: QuickReply) => {
    setFormData({
      title: reply.title,
      message: reply.message,
      shortcut: reply.shortcut,
      tags: reply.tags
    });
    setEditingId(reply.id);
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this quick reply?')) {
      setQuickReplies(prev => prev.filter(reply => reply.id !== id));
      toast({
        title: "Quick reply deleted",
        description: "The quick reply has been removed",
      });
    }
  };

  const handleCopyToClipboard = (message: string) => {
    navigator.clipboard.writeText(message);
    toast({
      title: "Copied to clipboard",
      description: "Ready to paste in your message",
    });
  };

  const filteredReplies = quickReplies.filter(reply => {
    const matchesSearch = 
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = selectedTag === 'all' || reply.tags.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BoltIcon className="w-6 h-6 text-primary" />
            Quick Replies
          </h1>
          <p className="text-muted-foreground">
            Saved messages for fast responses in conversations
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Quick Reply
        </Button>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Replies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quickReplies.length}</div>
            <p className="text-sm text-muted-foreground">Saved quick replies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quickReplies.reduce((sum, reply) => sum + reply.usageCount, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Times used in conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Most Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quickReplies.reduce((max, reply) => Math.max(max, reply.usageCount), 0)}
            </div>
            <p className="text-sm text-muted-foreground">Highest usage count</p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{editingId ? 'Edit Quick Reply' : 'Create New Quick Reply'}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setFormData({
                    title: '',
                    message: '',
                    shortcut: '',
                    tags: []
                  });
                }}
              >
                Cancel
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Welcome Message"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortcut">Shortcut</Label>
                <Input
                  id="shortcut"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="e.g., /welcome"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Type this in chat to insert quickly
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message Content *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter your message here..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Use variables like {'{name}'} or {'{date}'} for personalization
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newTags = formData.tags.includes(tag)
                        ? formData.tags.filter(t => t !== tag)
                        : [...formData.tags, tag];
                      setFormData({ ...formData, tags: newTags });
                    }}
                  >
                    <TagIcon className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                <Input
                  placeholder="Add new tag..."
                  className="w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const newTag = e.currentTarget.value.trim().toLowerCase();
                      if (!formData.tags.includes(newTag)) {
                        setFormData({ ...formData, tags: [...formData.tags, newTag] });
                      }
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                setFormData({
                  title: '',
                  message: '',
                  shortcut: '',
                  tags: []
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate}>
                {editingId ? 'Update Quick Reply' : 'Create Quick Reply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search quick replies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Badge
            variant={selectedTag === 'all' ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setSelectedTag('all')}
          >
            All ({quickReplies.length})
          </Badge>
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setSelectedTag(tag)}
            >
              <TagIcon className="w-3 h-3 mr-1" />
              {tag} ({quickReplies.filter(r => r.tags.includes(tag)).length})
            </Badge>
          ))}
        </div>
      </div>

      {/* Quick Replies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReplies.map((reply) => (
          <Card key={reply.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{reply.title}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {reply.shortcut}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(reply)}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(reply.id)}
                  >
                    <TrashIcon className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {reply.message}
              </p>
              
              {reply.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {reply.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <TagIcon className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ClipboardDocumentIcon className="w-3 h-3" />
                  <span>Used {reply.usageCount} times</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(reply.message)}
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Use
                    <ChevronRightIcon className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredReplies.length === 0 && (
        <div className="text-center py-12">
          <BoltIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quick replies found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedTag !== 'all' 
              ? 'Try a different search or filter'
              : 'Create your first quick reply to get started'}
          </p>
          <Button onClick={() => setIsCreating(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Quick Reply
          </Button>
        </div>
      )}
    </div>
  );
};