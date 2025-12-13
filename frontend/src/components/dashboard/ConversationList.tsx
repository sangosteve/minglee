import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  status: "open" | "resolved" | "pending";
  channel: "whatsapp" | "instagram" | "web";
}

const conversations: Conversation[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    lastMessage: "Thanks for the quick response! I'll check it out.",
    time: "2m ago",
    unread: true,
    status: "open",
    channel: "whatsapp",
  },
  {
    id: "2",
    name: "Mike Chen",
    lastMessage: "Can you help me with my order #12345?",
    time: "5m ago",
    unread: true,
    status: "pending",
    channel: "whatsapp",
  },
  {
    id: "3",
    name: "Emily Davis",
    lastMessage: "Great, I'll proceed with the payment then.",
    time: "15m ago",
    unread: false,
    status: "open",
    channel: "instagram",
  },
  {
    id: "4",
    name: "Alex Thompson",
    lastMessage: "Issue has been resolved. Thank you!",
    time: "1h ago",
    unread: false,
    status: "resolved",
    channel: "web",
  },
  {
    id: "5",
    name: "Lisa Wang",
    lastMessage: "I'd like to schedule a demo please",
    time: "2h ago",
    unread: false,
    status: "open",
    channel: "whatsapp",
  },
];

const channelColors = {
  whatsapp: "bg-success",
  instagram: "bg-pink-500",
  web: "bg-primary",
};

const statusIcons = {
  open: null,
  resolved: <CheckCircleIcon className="w-4 h-4 text-success" />,
  pending: <ClockIcon className="w-4 h-4 text-warning" />,
};

export function ConversationList() {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Recent Conversations</h3>
        <p className="text-sm text-muted-foreground">Latest customer interactions</p>
      </div>
      <div className="divide-y divide-border">
        {conversations.map((conversation, index) => (
          <div
            key={conversation.id}
            className={cn(
              "flex items-center gap-4 p-4 hover:bg-secondary/50 cursor-pointer transition-colors animate-slide-in",
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {conversation.name.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                  channelColors[conversation.channel]
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "font-medium truncate",
                  conversation.unread ? "text-foreground" : "text-muted-foreground"
                )}>
                  {conversation.name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {conversation.time}
                </span>
              </div>
              <p className={cn(
                "text-sm truncate",
                conversation.unread ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {conversation.lastMessage}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {statusIcons[conversation.status]}
              {conversation.unread && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-border">
        <button className="w-full text-sm font-medium text-primary hover:text-primary-hover transition-colors">
          View all conversations →
        </button>
      </div>
    </div>
  );
}
