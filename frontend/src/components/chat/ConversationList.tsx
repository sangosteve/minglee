import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime, getInitials, getStatusIndicator, getContactStatus } from "./message-utils";
import { MagnifyingGlassIcon, FunnelIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

interface ConversationListProps {
  conversations: any[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTab: string;
  onTabChange: (value: string) => void;
  unreadCount?: number;
}

const ConversationItem = ({ 
  conversation, 
  isSelected, 
  onSelect 
}: { 
  conversation: any; 
  isSelected: boolean; 
  onSelect: () => void;
}) => {
  const contact = conversation.contact;
  const contactStatus = getContactStatus(contact?.status);

  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full flex items-start gap-3 p-4 h-auto hover:bg-secondary/50 transition-colors border-b border-border rounded-none relative group",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
      onClick={onSelect}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {getInitials(contact?.name)}
          </span>
        </div>
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
            getStatusIndicator(contactStatus)
          )}
        />
      </div>

      {/* Main content area - takes remaining space */}
      <div className="flex-1 min-w-0">
        {/* Top row: Contact name + Time */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-foreground truncate">
            {contact?.name || contact?.phone || "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-2">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        {/* Bottom row: Last message + Badge */}
        <div className="flex items-start w-full">
          <p className="text-sm text-muted-foreground truncate pr-2 flex-1 text-start">
            {conversation.lastMessage || "No messages yet"}
          </p>
          {conversation.unreadCount > 0 && (
            <Badge
              className="h-5 min-w-[20px] px-1 flex items-center justify-center bg-primary text-primary-foreground text-xs flex-shrink-0 mt-1"
              variant="default"
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </Button>
  );
};

const EmptyState = ({ inboxType, searchQuery }: { inboxType: string, searchQuery: string }) => (
  <div className="p-8 text-center">
    <ChatBubbleLeftRightIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground">No conversations found</p>
    {inboxType === 'mine' && (
      <p className="text-sm text-muted-foreground mt-2">
        You don't have any assigned conversations
      </p>
    )}
    {inboxType === 'unassigned' && (
      <p className="text-sm text-muted-foreground mt-2">
        All conversations are assigned
      </p>
    )}
    {searchQuery && (
      <p className="text-sm text-muted-foreground mt-2">
        Try a different search term
      </p>
    )}
  </div>
);

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  selectedTab,
  onTabChange,
  unreadCount
}) => {
  return (
    <div className="w-80 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-10"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-auto"
              >
                <FunnelIcon className="w-4 h-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Advanced filters</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <Tabs value={selectedTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="All" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="Unread" className="text-xs relative">
              Unread
              {unreadCount && unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs min-w-5"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="Open" className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="Resolved" className="text-xs">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <EmptyState inboxType="all" searchQuery={searchQuery} />
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedConversationId}
              onSelect={() => onSelectConversation(conv.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
};