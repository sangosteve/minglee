import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  DocumentIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { AttachmentPreview as AttachmentPreviewType } from "./hooks/useMessageHandlers";

interface AttachmentPreviewProps {
  attachments: AttachmentPreviewType[];
  quickReplyMediaAttachments: any[];
  caption: string;
  onClearAll: () => void;
  onRemoveAttachment: (index: number) => void;
  onCaptionChange: (caption: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  quickReplyMediaAttachments,
  caption,
  onClearAll,
  onRemoveAttachment,
  onCaptionChange,
}) => {
  // Quick reply media attachments preview
  if (quickReplyMediaAttachments.length > 0) {
    return (
      <div className="p-4 pb-0">
        <div className="bg-secondary rounded-xl p-3 border-2 border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">
                <BoltIcon className="w-3 h-3 mr-1" />
                Quick Reply Media
              </Badge>
              <span className="text-sm font-medium text-foreground">
                {quickReplyMediaAttachments.length} file{quickReplyMediaAttachments.length > 1 ? "s" : ""} from quick reply
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
              onClick={onClearAll}
            >
              Clear all
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {quickReplyMediaAttachments.map((attachment, index) => {
              const getIcon = (mimeType: string) => {
                if (mimeType?.startsWith('image/')) return PhotoIcon;
                if (mimeType?.startsWith('video/')) return FilmIcon;
                if (mimeType?.startsWith('audio/')) return MusicalNoteIcon;
                if (mimeType?.includes('zip') || mimeType?.includes('rar')) return ArchiveBoxIcon;
                return DocumentIcon;
              };

              const Icon = getIcon(attachment.mimeType);
              const filename = attachment.originalFilename || attachment.filename || `Media ${index + 1}`;

              return (
                <div key={index} className="relative group">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex flex-col items-center justify-center p-1 cursor-help">
                        <Icon className="w-5 h-5 text-primary" />
                        <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">
                          {filename.slice(0, 8)}...
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.mimeType || 'Unknown type'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>

          {/* Caption input for quick reply media */}
          <Input
            type="text"
            placeholder="Add a caption for these files..."
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            className="w-full mt-2"
          />
        </div>
      </div>
    );
  }

  // Local attachments preview (only show if no quick reply media)
  if (attachments.length > 0) {
    return (
      <div className="p-4 pb-0">
        <div className="bg-secondary rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              {attachments.length} file{attachments.length > 1 ? "s" : ""} attached
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
              onClick={onClearAll}
            >
              Clear all
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((attachment, index) => {
              const Icon = attachment.type === "image" ? PhotoIcon :
                attachment.type === "video" ? FilmIcon :
                  attachment.type === "audio" ? MusicalNoteIcon :
                    attachment.type === "compressed" ? ArchiveBoxIcon : DocumentIcon;

              return (
                <div key={index} className="relative group">
                  <div className="w-20 h-20 bg-primary/5 rounded-lg overflow-hidden">
                    {attachment.type === "image" && attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <Icon className="w-8 h-8 text-primary/60" />
                        <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                          {attachment.file.name.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => onRemoveAttachment(index)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Input
            type="text"
            placeholder="Add a caption for all files..."
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return null;
};