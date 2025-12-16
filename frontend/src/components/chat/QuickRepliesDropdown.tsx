import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BoltIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { QuickReply } from '@/lib/api/quick-replies';
import { toast } from '@/hooks/use-toast';

interface QuickRepliesDropdownProps {
  quickReplies: QuickReply[];
  isLoading: boolean;
  onSelect: (message: string) => void;
  conversationId?: string;
  contact?: any;
  sendQuickReply?: any;
}

const QuickRepliesDropdown: React.FC<QuickRepliesDropdownProps> = ({
  quickReplies,
  isLoading,
  onSelect,
  conversationId,
  contact,
  sendQuickReply,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Filter quick replies
  const filteredReplies = quickReplies.filter((reply) => {
    const matchesSearch = searchQuery
      ? reply.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reply.message.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesTopic = selectedTopic
      ? reply.topics.includes(selectedTopic)
      : true;
    
    return matchesSearch && matchesTopic;
  });

  // Get unique topics
  const topics = Array.from(
    new Set(quickReplies.flatMap((reply) => reply.topics.split(',').map((t) => t.trim())))
  ).filter(Boolean);

  const handleSendQuickReply = async (quickReply: QuickReply) => {
    if (!conversationId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation first",
        variant: "destructive",
      });
      return;
    }

    try {
      if (sendQuickReply) {
        await sendQuickReply.mutateAsync({
          conversationId,
          quickReplyId: quickReply.id,
        });
      } else {
        // Fallback: just insert into input
        onSelect(quickReply.message);
      }
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  const handleSelect = async (quickReply: QuickReply) => {
    if (conversationId && contact && sendQuickReply) {
      // If we have a conversation and send function, send directly
      await handleSendQuickReply(quickReply);
    } else {
      // Otherwise, just insert into input
      onSelect(quickReply.message);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          <BoltIcon className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-96 bg-card border-border z-50" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between">
            <span>Quick Replies</span>
            {conversationId && contact && (
              <Badge variant="outline" className="text-xs">
                Personalized
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        
        {/* Search */}
        <div className="px-2 py-1.5">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search quick replies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Topics filter */}
        {topics.length > 0 && (
          <div className="px-2 py-1.5">
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={selectedTopic === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedTopic(null)}
              >
                All
              </Badge>
              {topics.map((topic) => (
                <Badge
                  key={topic}
                  variant={selectedTopic === topic ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedTopic(topic === selectedTopic ? null : topic)}
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Quick replies list */}
        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto" />
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No quick replies found
            </div>
          ) : (
            filteredReplies.map((reply) => (
              <div key={reply.id} className="border-b border-border last:border-0">
                <DropdownMenuItem
                  className="flex flex-col items-start p-3 cursor-pointer hover:bg-secondary"
                  onClick={() => handleSelect(reply)}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{reply.name}</span>
                        {reply.mediaAttachments && reply.mediaAttachments.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{reply.mediaAttachments.length} media
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {reply.message}
                      </p>
                      {reply.topics && (
                        <div className="mt-1 flex items-center gap-1">
                          {reply.topics.split(',').map((topic) => (
                            <span
                              key={topic}
                              className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                            >
                              {topic.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1 ml-2">
                      {conversationId && contact && sendQuickReply && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendQuickReply(reply);
                          }}
                          title="Send directly"
                        >
                          <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Variables info */}
        {conversationId && contact && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 text-xs text-muted-foreground p-2">
              <InformationCircleIcon className="w-4 h-4" />
              <span>
                Quick replies include variables like {'{{contact.name}}'}, {'{{date.today}}'}, etc.
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickRepliesDropdown;