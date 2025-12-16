import React, { useState } from "react";
import { BoltIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { QuickReply } from "@/lib/api/quick-replies";

interface QuickRepliesDropdownProps {
  onSelect: (message: string) => void;
  quickReplies: QuickReply[];
  isLoading: boolean;
}

const QuickRepliesDropdown = ({ 
  onSelect, 
  quickReplies, 
  isLoading 
}: QuickRepliesDropdownProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Filter quick replies based on search
 const filteredReplies = (quickReplies ?? []).filter(reply =>

    reply.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reply.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reply.topics.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by topics
const groupedReplies = filteredReplies.reduce((acc, reply) => {
  const topics = reply.topics
    ? reply.topics.split(',').map(t => t.trim())
    : ['General'];

  topics.forEach(topic => {
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(reply);
  });

  return acc;
}, {} as Record<string, QuickReply[]>);

  const handleSelect = (message: string) => {
    onSelect(message);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <BoltIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Quick replies</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent 
        align="start" 
        className="w-80 bg-card border-border z-50" 
        sideOffset={8}
      >
        <div className="p-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search quick replies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading quick replies...</p>
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No quick replies found" : "No quick replies yet"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">
                  Create quick replies in the Quick Replies section
                </p>
              )}
            </div>
          ) : (
            <>
              {Object.entries(groupedReplies).map(([topic, replies]) => (
                <div key={topic}>
                  <div className="px-3 py-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {topic}
                    </p>
                  </div>
                  {replies.map((reply) => (
                    <DropdownMenuItem
                      key={reply.id}
                      onSelect={() => handleSelect(reply.message)}
                      className="flex flex-col items-start p-3 cursor-pointer hover:bg-secondary/50"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-foreground text-sm">
                          {reply.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {reply.mediaAttachments?.length ? 
                            `📎 ${reply.mediaAttachments.length}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 text-left">
                        {reply.message}
                      </p>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickRepliesDropdown;