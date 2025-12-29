// components/automations/nodes/TagNode.tsx
"use client"

import type React from "react"
import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { 
  TagIcon, 
  EllipsisHorizontalIcon,
  ClipboardDocumentIcon, 
  DocumentDuplicateIcon, 
  ArrowsRightLeftIcon,
  HashtagIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface TagNodeData {
  action?: 'add' | 'remove' | 'toggle'
  tagNames?: string[]
  label?: string
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  onSelect?: (id: string) => void
}

function TagNode({ data, id, selected }: NodeProps<TagNodeData>) {
  const [showMenu, setShowMenu] = useState(false)
  const action = data.action || 'add'
  const tagNames = data.tagNames || []
  
  const actionConfigs = {
    add: { 
      label: 'Add Tags', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      icon: <PlusIcon className="h-4 w-4" />
    },
    remove: { 
      label: 'Remove Tags', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      icon: <MinusIcon className="h-4 w-4" />
    },
    toggle: { 
      label: 'Toggle Tags', 
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      icon: <TagIcon className="h-4 w-4" />
    }
  }
  
  const config = actionConfigs[action] || actionConfigs.add

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Copy tag block:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Duplicate tag block:", id)
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

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[280px] group cursor-pointer",
        selected && "border-green-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className={cn("w-8 h-8 rounded flex items-center justify-center", config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">
            {data.label || config.label}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {tagNames.length > 0 ? `${tagNames.length} tag(s)` : "No tags configured"}
          </div>
        </div>
        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
            >
              <EllipsisHorizontalIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleSelect} className="gap-2">
              <TagIcon className="h-4 w-4" />
              Configure tags
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2">
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2">
              <DocumentDuplicateIcon className="h-4 w-4" />
              Duplicate block
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <TrashIcon className="h-4 w-4" />
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tag Details */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Action</span>
          <Badge variant="secondary" className={config.color}>
            {config.icon} {config.label}
          </Badge>
        </div>

        {/* Show tags if configured */}
        {tagNames.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Tags:</div>
            <div className="flex flex-wrap gap-1">
              {tagNames.slice(0, 3).map((tagName, idx) => (
                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5">
                  #{tagName}
                </Badge>
              ))}
              {tagNames.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                  +{tagNames.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Description */}
        <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
          {action === 'add' && '📌 Adds tags to contact'}
          {action === 'remove' && '🗑️ Removes tags from contact'}
          {action === 'toggle' && '🔄 Toggles tags on contact'}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm"
      />
    </div>
  )
}

export default memo(TagNode)