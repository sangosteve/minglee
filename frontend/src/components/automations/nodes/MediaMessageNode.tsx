"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { 
  PhotoIcon, 
  EllipsisHorizontalIcon,
  PaperClipIcon 
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface MediaMessageNodeData {
  media?: {
    type?: 'image' | 'video' | 'audio' | 'document'
    url?: string
    thumbnailUrl?: string
    filename?: string
    caption?: string
  }
  mediaAttachmentId?: string
  caption?: string
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  onSelect?: (id: string) => void
}

const MediaMessageNode = ({ data, id, selected }: NodeProps<MediaMessageNodeData>) => {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Copy block:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Duplicate block:", id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onDelete) {
      data.onDelete(id)
    }
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onSelect) {
      data.onSelect(id)
    }
  }

  const getMediaTypeIcon = (type?: string) => {
    switch (type) {
      case 'image': return '🖼️'
      case 'video': return '🎬'
      case 'audio': return '🎵'
      case 'document': return '📄'
      default: return '📎'
    }
  }

  const getMediaTypeColor = (type?: string) => {
    switch (type) {
      case 'image': return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
      case 'video': return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      case 'audio': return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
      case 'document': return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
    }
  }

  const media = data.media || {}
  const mediaType = media.type || 'image'
  const hasMedia = !!media.url || !!data.mediaAttachmentId

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group cursor-pointer",
        selected && "border-purple-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className={cn("w-8 h-8 rounded flex items-center justify-center", getMediaTypeColor(mediaType))}>
          <span className="text-sm">{getMediaTypeIcon(mediaType)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">
            Send Media
          </div>
          <div className="text-xs text-muted-foreground">
            {hasMedia ? `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} message` : "No media selected"}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <EllipsisHorizontalIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem 
              onClick={handleSelect} 
              className="gap-2 text-foreground"
            >
              Edit media
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-foreground">
              Copy block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2 text-foreground">
              Duplicate block
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDelete} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="px-4 py-3">
        {hasMedia ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getMediaTypeColor(mediaType)}>
                {getMediaTypeIcon(mediaType)} {mediaType.toUpperCase()}
              </Badge>
              {media.filename && (
                <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
                  {media.filename}
                </Badge>
              )}
            </div>
            
            {media.caption && (
              <div className="text-sm text-muted-foreground break-words line-clamp-2">
                {media.caption}
              </div>
            )}
            
            {media.thumbnailUrl && media.type === 'image' && (
              <div className="mt-2 rounded overflow-hidden border border-border">
                <img 
                  src={media.thumbnailUrl} 
                  alt="Media preview" 
                  className="w-full h-24 object-cover"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            Click to select media file
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Media Message
          </span>
          <span className="text-xs text-purple-600 font-medium dark:text-purple-400">
            {hasMedia ? "Ready to send" : "Not configured"}
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
      />
    </div>
  )
}

export default MediaMessageNode