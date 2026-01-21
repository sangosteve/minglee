import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  getMediaType, 
  hasMediaContent, 
  getMediaUrl, 
  getFilename, 
  formatFileSize,
  getFileIconColor,
  formatMessageTime 
} from "./message-utils";
import { type Message } from "@/lib/api/conversations";
import {
  VideoCameraIcon,
  MusicalNoteIcon,
  DocumentIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
  FilmIcon,
} from "@heroicons/react/24/outline";

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  onDownloadMedia?: (message: Message) => void;
  onViewMedia?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  onDownloadMedia,
  onViewMedia
}) => {
  const hasMedia = hasMediaContent(message);
  const mediaType = getMediaType(message);
  const mediaUrl = getMediaUrl(message);
  const filename = getFilename(message);
  const isInteractive = mediaType === 'interactive';
  const isButton = mediaType === 'button';
  const isLocation = mediaType === 'location';
  const isContacts = mediaType === 'contacts';
  const shouldShowMediaSection = hasMedia && !isInteractive && !isButton && !isLocation && !isContacts;
  const shouldShowText = message.body && !hasMedia && !isInteractive && !isButton && !isLocation && !isContacts;

  const handleDownload = () => {
    if (onDownloadMedia) onDownloadMedia(message);
  };

  const handleView = () => {
    if (onViewMedia) onViewMedia(message);
  };

  return (
    <div
      className={cn(
        "flex mb-4",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[280px] rounded-2xl overflow-hidden",
          (hasMedia || isInteractive || isButton || isLocation || isContacts) ? "p-0" : "px-4 py-2.5",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border text-foreground rounded-bl-md"
        )}
      >
        {/* Interactive Messages */}
        {isInteractive && (
          <InteractiveMessage message={message} isOutgoing={isOutgoing} />
        )}

        {/* Button Messages */}
        {isButton && (
          <ButtonMessage message={message} isOutgoing={isOutgoing} />
        )}

        {/* Location Messages */}
        {isLocation && (
          <LocationMessage message={message} isOutgoing={isOutgoing} />
        )}

        {/* Contacts Messages */}
        {isContacts && (
          <ContactsMessage message={message} isOutgoing={isOutgoing} />
        )}

        {/* Media Messages */}
        {shouldShowMediaSection && (
          <MediaMessage
            message={message}
            mediaType={mediaType}
            mediaUrl={mediaUrl}
            filename={filename}
            isOutgoing={isOutgoing}
            onDownload={handleDownload}
            onView={handleView}
          />
        )}

        {/* Text Messages */}
        {shouldShowText && (
          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        )}

        {/* Message timestamp and status */}
        <div className={cn(
          "flex items-center gap-1 px-3 pb-2",
          (hasMedia || isInteractive || isButton || isLocation || isContacts) ? "" : "px-0 pb-0 mt-1",
          isOutgoing ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-xs",
            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatMessageTime(message.timestamp)}
          </span>
          {isOutgoing && (
            <span className="text-xs opacity-70">
              {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const InteractiveMessage = ({ message, isOutgoing }: { message: Message, isOutgoing: boolean }) => (
  <div className={cn(
    "w-full p-4",
    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
  )}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        🔄
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isOutgoing ? "text-primary-foreground" : "text-foreground"
        )}>
          Interactive Message
        </p>
        <p className={cn(
          "text-xs truncate",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {message.metadata?.interactive?.type === 'list_reply' &&
            `Selected: ${message.metadata.interactive.data?.title || 'Option'}`}
          {message.metadata?.interactive?.type === 'button_reply' &&
            `Clicked: ${message.metadata.interactive.data?.title || 'Button'}`}
          {message.metadata?.interactive?.type === 'nfm_reply' &&
            'Flow response'}
          {!message.metadata?.interactive?.type && 'Interactive content'}
        </p>
      </div>
    </div>
    {message.body && message.body !== 'Interactive message' && (
      <p className={cn(
        "text-sm mt-2",
        isOutgoing ? "text-primary-foreground" : "text-foreground"
      )}>
        {message.body}
      </p>
    )}
  </div>
);

const ButtonMessage = ({ message, isOutgoing }: { message: Message, isOutgoing: boolean }) => (
  <div className={cn(
    "w-full p-4",
    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
  )}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
        🔘
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isOutgoing ? "text-primary-foreground" : "text-foreground"
        )}>
          Button Message
        </p>
        <p className={cn(
          "text-xs truncate",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {message.metadata?.button?.text || message.body || 'Button action'}
        </p>
      </div>
    </div>
  </div>
);

const LocationMessage = ({ message, isOutgoing }: { message: Message, isOutgoing: boolean }) => (
  <div className={cn(
    "w-full p-3",
    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
  )}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        📍
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isOutgoing ? "text-primary-foreground" : "text-foreground"
        )}>
          Location Shared
        </p>
        <p className={cn(
          "text-xs truncate",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {message.metadata?.location?.name || message.metadata?.location?.address || message.body || 'Shared location'}
        </p>
      </div>
    </div>
    {message.metadata?.location && (
      <a
        href={`https://maps.google.com/?q=${message.metadata.location.latitude},${message.metadata.location.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "mt-2 w-full py-1.5 text-sm rounded-lg transition-colors text-center block",
          isOutgoing ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        View on Map
      </a>
    )}
  </div>
);

const ContactsMessage = ({ message, isOutgoing }: { message: Message, isOutgoing: boolean }) => (
  <div className={cn(
    "w-full p-4",
    isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
  )}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
        👥
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isOutgoing ? "text-primary-foreground" : "text-foreground"
        )}>
          Contact Shared
        </p>
        <p className={cn(
          "text-xs truncate",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {message.body || 'Contact information'}
        </p>
      </div>
    </div>
  </div>
);

const MediaMessage = ({ 
  message, 
  mediaType, 
  mediaUrl, 
  filename, 
  isOutgoing,
  onDownload,
  onView
}: { 
  message: Message; 
  mediaType: string; 
  mediaUrl?: string; 
  filename: string; 
  isOutgoing: boolean;
  onDownload: () => void;
  onView: () => void;
}) => (
  <div className="relative">
    {mediaType === "image" && mediaUrl && (
      <div className="relative">
        <img
          src={mediaUrl}
          alt={message.body || "Image"}
          className="w-full h-auto max-h-[400px] object-contain cursor-pointer bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={onDownload}
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download image</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )}

    {/* Video Messages */}
    {mediaType === "video" && mediaUrl && (
      <div className="relative w-full aspect-video bg-black/90">
        <video
          src={mediaUrl}
          controls
          className="w-full h-full object-contain"
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
        >
          Your browser does not support the video tag.
        </video>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={onDownload}
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download video</p>
          </TooltipContent>
        </Tooltip>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs">
          <VideoCameraIcon className="w-4 h-4" />
          <span>{message.metadata?.duration || "0:00"}</span>
        </div>
      </div>
    )}

    {/* Audio Messages */}
    {mediaType === "audio" && mediaUrl && (
      <div className={cn(
        "w-full p-4",
        isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
      )}>
        <div className="flex items-center gap-3">
          <audio
            src={mediaUrl}
            controls
            className="flex-1"
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  isOutgoing ? "bg-primary-foreground/20" : "bg-primary/10"
                )}
                onClick={onDownload}
              >
                <ArrowDownTrayIcon className={cn(
                  "w-5 h-5",
                  isOutgoing ? "text-primary-foreground" : "text-primary"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download audio</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {message.metadata?.duration && (
          <div className="flex items-center justify-between mt-2">
            <span className={cn(
              "text-xs",
              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              Duration: {message.metadata.duration}
            </span>
            <MusicalNoteIcon className={cn(
              "w-3.5 h-3.5",
              isOutgoing ? "text-primary-foreground/50" : "text-muted-foreground/50"
            )} />
          </div>
        )}
      </div>
    )}

    {/* Document & Sticker Messages */}
    {(mediaType === "document" || mediaType === "sticker") && (
      <div className={cn(
        "w-full p-3",
        isOutgoing ? "bg-primary-hover/50" : "bg-secondary"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            getFileIconColor(filename).bg
          )}>
            {mediaType === "sticker" ? (
              <ArchiveBoxIcon className="text-amber-500" />
            ) : (
              <DocumentIcon className={getFileIconColor(filename).text} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              isOutgoing ? "text-primary-foreground" : "text-foreground"
            )}>
              {filename}
            </p>
            <p className={cn(
              "text-xs",
              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {formatFileSize(message.metadata?.fileSize)}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isOutgoing ? "hover:bg-primary-foreground/10" : "hover:bg-muted"
                )}
                onClick={onDownload}
              >
                <ArrowDownTrayIcon className={cn(
                  "w-4 h-4",
                  isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download file</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    )}

    {/* Show caption for media messages */}
    {message.body && mediaType !== "audio" && mediaType !== "document" && mediaType !== "sticker" && (
      <div className="px-3 py-2">
        <p className={cn(
          "text-sm",
          isOutgoing ? "text-primary-foreground" : "text-foreground"
        )}>
          {message.body}
        </p>
      </div>
    )}
  </div>
);