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
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { QuickReply } from '@/lib/api/quick-replies';
import { VariableService } from '@/lib/variable-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuickRepliesDropdownProps {
  quickReplies: QuickReply[];
  isLoading: boolean;
  onInsertIntoInput: (message: string) => void;
  conversationId?: string;
  contact?: any;
  user?: any; // Add user prop
  conversation?: any; // Add conversation prop
}

const QuickRepliesDropdown: React.FC<QuickRepliesDropdownProps> = ({
  quickReplies,
  isLoading,
  onInsertIntoInput,
  conversationId,
  contact,
  user,
  conversation,
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

  const handleSelectQuickReply = (quickReply: QuickReply) => {
    // Client-side personalization - INSTANT!
    const personalizedMessage = VariableService.replaceVariables(
      quickReply.message,
      { contact, user, conversation }
    );
    
    // Insert into input field
    onInsertIntoInput(personalizedMessage);
    
    // Show success toast
    toast({
      title: "Quick reply inserted",
      description: "Personalized message added to input field",
    });
  };

  // Check which quick replies have variables
  const quickRepliesWithVariables = filteredReplies.map(reply => ({
    ...reply,
    hasVariables: VariableService.extractVariables(reply.message).length > 0,
    preview: conversationId && contact && user 
      ? VariableService.replaceVariables(reply.message, { contact, user, conversation })
      : reply.message,
  }));

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
                <SparklesIcon className="w-3 h-3 mr-1" />
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
          ) : quickRepliesWithVariables.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No quick replies found
            </div>
          ) : (
            quickRepliesWithVariables.map((reply) => (
              <div key={reply.id} className="border-b border-border last:border-0">
                <DropdownMenuItem
                  className="flex flex-col items-start p-3 cursor-pointer hover:bg-secondary group"
                  onClick={() => handleSelectQuickReply(reply)}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{reply.name}</span>
                        {reply.hasVariables && conversationId && contact && (
                          <Badge variant="secondary" className="text-xs">
                            <SparklesIcon className="w-3 h-3 mr-1" />
                            Personalized
                          </Badge>
                        )}
                        {reply.mediaAttachments && reply.mediaAttachments.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            +{reply.mediaAttachments.length} media
                          </Badge>
                        )}
                      </div>
                      
                      {/* Show preview (personalized if available) */}
                      <div className="space-y-1">
                        <p className={cn(
                          "text-sm line-clamp-2",
                          reply.hasVariables && conversationId && contact
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}>
                          {reply.preview}
                        </p>
                        
                        {/* Show original template if personalized */}
                        {reply.hasVariables && conversationId && contact && reply.message !== reply.preview && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            Template: {reply.message}
                          </p>
                        )}
                      </div>
                      
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
                  </div>
                </DropdownMenuItem>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Variables info */}
        <DropdownMenuSeparator />
        <div className="p-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Available variables:</p>
              <div className="flex flex-wrap gap-1">
                {VariableService.getAvailableVariables().slice(0, 6).map((variable) => (
                  <code
                    key={variable.placeholder}
                    className="px-1.5 py-0.5 bg-muted rounded text-[10px]"
                    title={variable.description}
                  >
                    {variable.placeholder}
                  </code>
                ))}
                {VariableService.getAvailableVariables().length > 6 && (
                  <span className="text-[10px]">+{VariableService.getAvailableVariables().length - 6} more</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickRepliesDropdown;