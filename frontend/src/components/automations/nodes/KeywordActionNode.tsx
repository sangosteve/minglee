// frontend/src/components/automations/nodes/KeywordActionNode.tsx
"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  KeyboardIcon,
  MoreHorizontalIcon,
  GridIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons"

interface KeywordActionNodeData {
  label?: string
  keywords?: string[]
  matchType?: 'exact' | 'contains' | 'startsWith' | 'endsWith'
  caseSensitive?: boolean
  matchAll?: boolean // true = AND logic, false = OR logic
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  onSelect?: (id: string) => void
}

function KeywordActionNode({ data, id, selected }: NodeProps<KeywordActionNodeData>) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Copy keyword node:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Duplicate keyword node:", id)
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

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'exact': return 'Exact'
      case 'contains': return 'Contains'
      case 'startsWith': return 'Starts with'
      case 'endsWith': return 'Ends with'
      default: return 'Contains'
    }
  }

  const getMatchAllLabel = (matchAll: boolean) => {
    return matchAll ? 'All keywords' : 'Any keyword'
  }

  const keywords = data.keywords || []
  const matchType = data.matchType || 'contains'
  const caseSensitive = data.caseSensitive || false
  const matchAll = data.matchAll || false
  const hasKeywords = keywords.length > 0

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group cursor-pointer",
        selected && "border-amber-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-amber-100 rounded flex items-center justify-center dark:bg-amber-900/20">
          <HugeiconsIcon 
            icon={KeyboardIcon} 
            size={16} 
            className="text-amber-600 dark:text-amber-400" 
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Check Keywords"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {hasKeywords ? `${keywords.length} keyword(s)` : "Not configured"}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem 
              onClick={handleSelect} 
              className="gap-2 text-foreground"
            >
              Configure keywords
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

      {/* Node Content */}
      <div className="px-4 py-3">
        <div className="space-y-2">
          {hasKeywords ? (
            <>
              {/* Settings Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <HugeiconsIcon icon={GridIcon} size={12} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Match:</span>
                  <span className="font-medium text-foreground">{getMatchTypeLabel(matchType)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {caseSensitive ? (
                    <HugeiconsIcon icon={TextFontIcon} size={12} className="text-muted-foreground" />
                  ) : (
                    <HugeiconsIcon icon={TextFontIcon} size={12} className="text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">Case:</span>
                  <span className="font-medium text-foreground">
                    {caseSensitive ? 'Sensitive' : 'Insensitive'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Logic:</span>
                  <span className="font-medium text-foreground">
                    {getMatchAllLabel(matchAll)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium text-foreground">{keywords.length}</span>
                </div>
              </div>

              {/* Keywords Preview */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-foreground">Keywords:</div>
                <div className="flex flex-wrap gap-1">
                  {keywords.slice(0, 3).map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      {keyword.length > 10 ? `${keyword.substring(0, 10)}...` : keyword}
                    </span>
                  ))}
                  {keywords.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{keywords.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Example */}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                Example: Will check if message{" "}
                <span className="font-medium text-foreground">
                  {matchType === 'exact' ? 'exactly matches' : 
                   matchType === 'contains' ? 'contains' : 
                   matchType === 'startsWith' ? 'starts with' : 'ends with'}{" "}
                  {matchAll ? 'ALL' : 'ANY'} keywords
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              Click to configure keyword checking
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {hasKeywords ? "Will check message" : "Not configured"}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Keyword Check
          </span>
        </div>
      </div>

      {/* Handles - Similar to ConditionNode with match/no-match branches */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-card !shadow-sm"
      />

      {/* Match branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="match"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm"
        style={{ top: '35%' }}
      >
        <div className="absolute -right-12 top-1/2 -translate-y-1/2">
          <div className="w-16 flex justify-center">
            <Badge 
              variant="outline" 
              className="h-5 w-full text-[10px] whitespace-nowrap font-normal bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 shadow-sm flex items-center justify-center"
            >
              Match
            </Badge>
          </div>
        </div>
      </Handle>

      {/* No-match branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="no-match"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-card !shadow-sm"
        style={{ top: '65%' }}
      >
        <div className="absolute -right-12 top-1/2 -translate-y-1/2">
          <div className="w-16 flex justify-center">
            <Badge 
              variant="outline" 
              className="h-5 w-full text-[10px] whitespace-nowrap font-normal bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 shadow-sm flex items-center justify-center"
            >
              No Match
            </Badge>
          </div>
        </div>
      </Handle>
    </div>
  )
}

export default KeywordActionNode