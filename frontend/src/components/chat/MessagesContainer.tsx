import React, { useMemo, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import  DateSeparator  from "./DateSeparator";
import { isSameDay } from "date-fns";
import { type Message } from "@/lib/api/conversations";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

interface MessagesContainerProps {
  messages: Message[];
  isLoading: boolean;
  onDownloadMedia?: (message: Message) => void;
  onViewMedia?: (message: Message) => void;
}

const MessagesSkeleton = () => (
  <div className="space-y-4 p-4">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`w-2/3 h-16 bg-secondary rounded-2xl animate-pulse ${i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'}`}></div>
      </div>
    ))}
  </div>
);

const EmptyMessagesState = () => (
  <div className="h-full flex items-center justify-center min-h-[400px]">
    <div className="text-center bg-card/80 backdrop-blur-sm p-8 rounded-xl border border-border/50">
      <ChatBubbleLeftRightIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">No messages yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Start the conversation!
      </p>
    </div>
  </div>
);

export const MessagesContainer: React.FC<MessagesContainerProps> = ({
  messages,
  isLoading,
  onDownloadMedia,
  onViewMedia
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return <MessagesSkeleton />;
  }

  if (messages.length === 0) {
    return <EmptyMessagesState />;
  }

  let lastDate: Date | null = null;

  return (
    <ScrollArea className="flex-1">
      <div
        className="min-h-full bg-repeat bg-center"
        style={{
          backgroundColor: "hsl(var(--background))",
          backgroundImage: "url('/bg.png')",
          backgroundSize: "420px",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="relative z-10 p-4 min-h-full">
          {sortedMessages.map((message) => {
            const messageDate = new Date(message.timestamp);
            const messageElements: React.ReactNode[] = [];

            if (!lastDate || !isSameDay(lastDate, messageDate)) {
              messageElements.push(
                <DateSeparator
                  key={`date-${message.id}-${message.timestamp}`}
                  dateString={message.timestamp}
                />
              );
              lastDate = messageDate;
            }

            messageElements.push(
              <MessageBubble
                key={message.id}
                message={message}
                isOutgoing={message.direction === "outgoing"}
                onDownloadMedia={onDownloadMedia}
                onViewMedia={onViewMedia}
              />
            );

            return messageElements;
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  );
};