// frontend/src/components/dashboard/ConversationList.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical,
  MessageSquare,
  Clock,
  User,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversations } from "@/lib/api/conversations";

interface ConversationItemProps {
  id: string;
  contactName: string;
  lastMessage: string;
  timeAgo: string;
  unread: boolean;
  unreadCount?: number;
  status: 'active' | 'archived' | 'muted' | 'resolved';
}

const ConversationItem = ({ 
  contactName, 
  lastMessage, 
  timeAgo, 
  unread, 
  unreadCount,
  status 
}: ConversationItemProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      case 'muted': return 'bg-yellow-500';
      case 'resolved': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(status)}`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-semibold text-sm",
              unread ? "text-gray-900" : "text-gray-700"
            )}>
              {contactName || 'Unknown Contact'}
            </h4>
            {unreadCount && unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 truncate max-w-[200px]">
            {lastMessage || 'No messages yet'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-gray-500">{timeAgo}</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export const ConversationList = () => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'active'>('all');
  const { data: conversationsData, isLoading } = useConversations({
    limit: 8,
    sortBy: 'lastMessageAt',
    sortOrder: 'desc'
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const conversations = conversationsData?.conversations || [];

  // Filter conversations based on selected filter
  const filteredConversations = conversations.filter(conv => {
    if (filter === 'unread') return conv.unreadCount > 0;
    if (filter === 'active') return conv.status === 'active';
    return true;
  });

  // Get counts for filters
  const totalCount = conversations.length;
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;
  const activeCount = conversations.filter(c => c.status === 'active').length;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-xl">Recent Conversations</CardTitle>
          <CardDescription>Loading conversations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-gray-100 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Recent Conversations</CardTitle>
            <CardDescription>Latest customer interactions</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            View All
          </Button>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="flex-1"
          >
            All <Badge variant="secondary" className="ml-2">{totalCount}</Badge>
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
            className="flex-1"
          >
            Unread <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
            className="flex-1"
          >
            Active <Badge variant="secondary" className="ml-2">{activeCount}</Badge>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No conversations found</p>
            <p className="text-sm">Try changing the filter</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredConversations.slice(0, 8).map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  id={conversation.id}
                  contactName={conversation.contact?.name || conversation.contact?.phone || 'Unknown Contact'}
                  lastMessage={conversation.lastMessage || 'No messages yet'}
                  timeAgo={formatTimeAgo(conversation.lastMessageAt)}
                  unread={conversation.unreadCount > 0}
                  unreadCount={conversation.unreadCount > 0 ? conversation.unreadCount : undefined}
                  status={conversation.status}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>{activeCount} active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>{unreadCount} unread</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                Avg. response: {conversations.length > 0 ? '2.5m' : '--'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};