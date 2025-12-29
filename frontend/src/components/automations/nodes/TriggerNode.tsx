// components/automations/nodes/TriggerNode.tsx
"use client"

import type React from "react"
import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { 
  BoltIcon, 
  EllipsisHorizontalIcon,
  ClipboardDocumentIcon, 
  DocumentDuplicateIcon, 
  ArrowsRightLeftIcon,
  HashtagIcon,
  TrashIcon 
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

// Define trigger types for MVP
export const TRIGGER_TYPES = [
  { 
    id: 'new_conversation', 
    label: 'New Conversation', 
    description: 'When a contact messages for the first time',
    icon: '💬',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
  },
  { 
    id: 'message_received', 
    label: 'Message Received', 
    description: 'When any message is received',
    icon: '📩',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
  },
  { 
    id: 'keyword', 
    label: 'Keyword Match', 
    description: 'When message contains specific words',
    icon: '🔤',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
  }
] as const

export type TriggerType = typeof TRIGGER_TYPES[number]['id']

interface TriggerNodeData {
  triggerType?: TriggerType
  config?: {
    keywords?: string[]
    caseSensitive?: boolean
    matchAll?: boolean
  }
  label?: string
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  onSelect?: (id: string) => void
}

function TriggerNode({ data, id, selected }: NodeProps<TriggerNodeData>) {
  const [showMenu, setShowMenu] = useState(false)
  const triggerType = data.triggerType || 'new_conversation'
  const triggerConfig = data.config || {}
  
  const triggerInfo = TRIGGER_TYPES.find(t => t.id === triggerType) || TRIGGER_TYPES[0]

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Copy trigger block:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Duplicate trigger block:", id)
  }

  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Replace trigger block:", id)
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
        <div className={cn("w-8 h-8 rounded flex items-center justify-center", triggerInfo.color)}>
          <span className="text-sm">{triggerInfo.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">
            {data.label || triggerInfo.label}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {triggerInfo.description}
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
              <BoltIcon className="h-4 w-4" />
              Configure trigger
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2">
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2">
              <DocumentDuplicateIcon className="h-4 w-4" />
              Duplicate block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReplace} className="gap-2">
              <ArrowsRightLeftIcon className="h-4 w-4" />
              Replace block
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

      {/* Trigger Details */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Trigger Type</span>
          <Badge variant="secondary" className={triggerInfo.color}>
            {triggerInfo.icon} {triggerInfo.label}
          </Badge>
        </div>

        {/* Show keywords if it's a keyword trigger */}
        {triggerType === 'keyword' && triggerConfig.keywords && triggerConfig.keywords.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Keywords:</div>
            <div className="flex flex-wrap gap-1">
              {triggerConfig.keywords.slice(0, 3).map((keyword, idx) => (
                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5">
                  "{keyword}"
                </Badge>
              ))}
              {triggerConfig.keywords.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                  +{triggerConfig.keywords.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Trigger Logic Indicator */}
        <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
          ⚡ Triggers automation flow
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm opacity-0"
        isConnectable={false}
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm"
      />
    </div>
  )
}

export default memo(TriggerNode)