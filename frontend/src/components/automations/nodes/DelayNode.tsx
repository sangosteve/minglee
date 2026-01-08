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
  MoreHorizontalIcon,
  ClockIcon,
  ArrowRight01Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"

interface DelayNodeData {
  label?: string
  delayValue?: number
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days'
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  onSelect?: (id: string) => void
}

function DelayNode({ data, id, selected }: NodeProps<DelayNodeData>) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Copy delay node:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[Automation] Duplicate delay node:", id)
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

  const getDurationDisplay = (value: number, unit: string) => {
    if (value === 1) {
      unit = unit.slice(0, -1) // Remove 's' for singular
    }
    return `${value} ${unit}`
  }

  const delayValue = data.delayValue || 0
  const delayUnit = data.delayUnit || 'minutes'
  const hasDelay = delayValue > 0

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[280px] group cursor-pointer",
        selected && "border-indigo-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center dark:bg-indigo-900/20">
          <HugeiconsIcon 
            icon={ClockIcon} 
            size={16} 
            className="text-indigo-600 dark:text-indigo-400" 
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Delay"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {hasDelay ? `Wait ${getDurationDisplay(delayValue, delayUnit)}` : "Not configured"}
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
              Configure delay
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
        <div className="space-y-3">
          {hasDelay ? (
            <>
              {/* Delay Visualization */}
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-md dark:bg-indigo-900/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                    <HugeiconsIcon 
                      icon={PlayIcon} 
                      size={12} 
                      className="text-indigo-600 dark:text-indigo-400" 
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-indigo-300 dark:bg-indigo-700"></div>
                    <div className="w-8 h-0.5 bg-indigo-300 dark:bg-indigo-700"></div>
                    <div className="w-4 h-0.5 bg-indigo-300 dark:bg-indigo-700"></div>
                    <HugeiconsIcon 
                      icon={PauseIcon} 
                      size={12} 
                      className="text-indigo-400 dark:text-indigo-500" 
                    />
                    <div className="w-12 h-0.5 bg-indigo-300 dark:bg-indigo-700 animate-pulse"></div>
                    <div className="w-8 h-0.5 bg-indigo-300 dark:bg-indigo-700"></div>
                    <div className="w-4 h-0.5 bg-indigo-300 dark:bg-indigo-700"></div>
                    <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                      <HugeiconsIcon 
                        icon={PlayIcon} 
                        size={12} 
                        className="text-indigo-600 dark:text-indigo-400" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delay Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-1 p-2 bg-muted rounded">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold text-foreground">
                    {getDurationDisplay(delayValue, delayUnit)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-2 bg-muted rounded">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-semibold text-foreground capitalize">
                    {delayUnit}
                  </span>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                <div className="font-medium text-foreground mb-1">Timeline:</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: '30%' }}
                    ></div>
                  </div>
                  <span className="font-medium text-foreground">
                    {delayValue} {delayUnit.charAt(0)} wait
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-6">
              <HugeiconsIcon 
                icon={ClockIcon} 
                size={24} 
                className="mx-auto mb-2 text-indigo-400 dark:text-indigo-500" 
              />
              <div>Click to configure delay time</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {hasDelay ? "Will wait before continuing" : "Not configured"}
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            Delay
          </span>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-card !shadow-sm"
      >
        <div className="absolute -right-16 top-1/2 -translate-y-1/2">
          <div className="w-14 flex justify-center">
            <Badge 
              variant="outline" 
              className="h-5 w-full text-[10px] whitespace-nowrap font-normal bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 shadow-sm flex items-center justify-center gap-1"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              Continue
            </Badge>
          </div>
        </div>
      </Handle>
    </div>
  )
}

export default DelayNode