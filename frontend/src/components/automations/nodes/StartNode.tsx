// components/automations/nodes/StartNode.tsx
"use client"

import type React from "react"
import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { FlagIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { 
  ClipboardDocumentIcon, 
  DocumentDuplicateIcon, 
  ArrowsRightLeftIcon,
  HashtagIcon,
  TrashIcon 
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

function StartNode({ data, id }: NodeProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Copy block:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Duplicate block:", id)
  }

  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Replace block:", id)
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    console.log("Copied block id:", id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onDelete) {
      data.onDelete(id)
    }
  }

  return (
    <div className="bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[180px] group">
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
          <FlagIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-foreground">Starting point</div>
          <div className="text-xs text-muted-foreground">{data?.description || "Where your automation begins"}</div>
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
            <DropdownMenuItem onClick={handleCopyId} className="gap-2">
              <HashtagIcon className="h-4 w-4" />
              Copy block ID
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

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-card !shadow-md"
        style={{ right: -6 }}
      />
    </div>
  )
}

export default memo(StartNode)