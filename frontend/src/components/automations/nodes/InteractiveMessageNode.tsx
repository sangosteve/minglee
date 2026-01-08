// frontend/src/components/automations/nodes/InteractiveMessageNode.tsx
import type React from "react"
import { memo, useState, useRef, useLayoutEffect, useCallback, createElement } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { 
  MessageSquare, 
  MoreHorizontal, 
  Copy, 
  CopyPlus, 
  Replace, 
  Hash, 
  Trash2,
  Link,
  Phone,
  AlertCircle,
  List,
  Zap,
  ChevronRight,
  Image as ImageIcon,
  Video,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface InteractiveMessageNodeData {
  type: 'reply_buttons' | 'quick_replies' | 'list' | 'url_button' | 'call_button'
  header?: {
    type: 'text' | 'image' | 'video' | 'document'
    content?: string
    mediaId?: string
  }
  body: string
  footer?: string
  actions: Array<{
    id: string
    type: 'reply' | 'url' | 'call'
    title: string
    payload?: string
    url?: string
    phoneNumber?: string
  }>
  onDelete?: (id: string) => void
  onSelect?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  label?: string
}

function InteractiveMessageNode({ data, id, selected }: NodeProps<InteractiveMessageNodeData>) {
  const [showMenu, setShowMenu] = useState(false)
  const [handlePositions, setHandlePositions] = useState<number[]>([])
  const nodeRef = useRef<HTMLDivElement>(null)
  const actionRefs = useRef<(HTMLDivElement | null)[]>([])

  // Get type-specific information
  const getTypeInfo = (type: string) => {
    const typeMap = {
      'reply_buttons': { 
        label: 'Reply Buttons',
        subtitle: '1-3 buttons, full-width',
        icon: MessageSquare,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
        badgeColor: 'bg-purple-500 text-white'
      },
      'quick_replies': { 
        label: 'Quick Replies',
        subtitle: '4-10 buttons, pill-shaped',
        icon: Zap,
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
        badgeColor: 'bg-amber-500 text-white'
      },
      'list': { 
        label: 'List Message',
        subtitle: 'Sections with options',
        icon: List,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        badgeColor: 'bg-green-500 text-white'
      },
      'url_button': { 
        label: 'URL Button',
        subtitle: 'Opens link in browser',
        icon: Link,
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        badgeColor: 'bg-blue-500 text-white'
      },
      'call_button': { 
        label: 'Call Button',
        subtitle: 'Initiates phone call',
        icon: Phone,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        badgeColor: 'bg-red-500 text-white'
      }
    }
    return typeMap[type as keyof typeof typeMap] || typeMap.reply_buttons
  }

  const typeInfo = getTypeInfo(data.type)
  const TypeIcon = typeInfo.icon

  // Calculate handle positions
  useLayoutEffect(() => {
    if (!nodeRef.current || data.actions.length === 0) return

    const node = nodeRef.current
    const nodeHeight = node.offsetHeight

    const positions: number[] = []
    actionRefs.current.forEach((actionElement) => {
      if (actionElement && node) {
        const actionTop = actionElement.offsetTop
        const actionHeight = actionElement.offsetHeight
        const actionCenter = actionTop + actionHeight / 2
        const relativePosition = (actionCenter / nodeHeight) * 100
        positions.push(relativePosition)
      }
    })

    setHandlePositions(positions)
  }, [data.actions, data.header, data.body, data.footer])

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onSelect) {
      data.onSelect(id)
    }
  }, [data.onSelect, id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onDelete) {
      data.onDelete(id)
    }
  }, [data.onDelete, id])

  const getTruncatedText = (text: string, maxLength: number = 100) => {
    if (!text) return ""
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...'
  }

  // Get action icon component
  const getActionIcon = (type: string) => {
    const icons = {
      'reply': Zap,
      'url': Link,
      'call': Phone
    }
    
    const IconComponent = icons[type as keyof typeof icons]
    return IconComponent ? createElement(IconComponent, { className: "h-4 w-4 text-white flex-shrink-0" }) : null
  }

  // Get action color for WhatsApp styling
  const getActionColor = (type: string) => {
    const colors = {
      'reply': 'bg-[#0086EA] text-white hover:bg-[#0075D1]', // WhatsApp blue
      'url': 'bg-[#25D366] text-white hover:bg-[#20BD5C]', // WhatsApp green
      'call': 'bg-[#25D366] text-white hover:bg-[#20BD5C]' // WhatsApp green
    }
    return colors[type as keyof typeof colors] || 'bg-[#0086EA] text-white'
  }

  const totalActions = data.actions?.length || 0
  
  // Check WhatsApp limitations
  const isUrlButton = data.type === 'url_button'
  const isCallButton = data.type === 'call_button'
  const isReplyButtons = data.type === 'reply_buttons'
  const isQuickReplies = data.type === 'quick_replies'
  const isList = data.type === 'list'
  
  // Check for mixed types
  const hasReplyActions = data.actions?.some(a => a.type === 'reply')
  const hasUrlActions = data.actions?.some(a => a.type === 'url')
  const hasCallActions = data.actions?.some(a => a.type === 'call')
  
  const hasMixedTypes = (isReplyButtons && (hasUrlActions || hasCallActions)) || 
                       (isQuickReplies && (hasUrlActions || hasCallActions)) ||
                       (isUrlButton && (hasReplyActions || hasCallActions)) ||
                       (isCallButton && (hasReplyActions || hasUrlActions))
  
  const exceedsLimits = (isReplyButtons && totalActions > 3) || 
                       (isQuickReplies && totalActions > 10) ||
                       (isList && totalActions > 10) ||
                       ((isUrlButton || isCallButton) && totalActions > 1)

  // Get allowed action types
  const getAllowedActionTypes = () => {
    if (isReplyButtons || isQuickReplies) return ['reply']
    if (isUrlButton) return ['url']
    if (isCallButton) return ['call']
    if (isList) return ['reply', 'url', 'call']
    return ['reply']
  }

  // Get header icon component
  const getHeaderIcon = () => {
    if (!data.header?.type) return null
    
    const icons = {
      'text': MessageSquare,
      'image': ImageIcon,
      'video': Video,
      'document': FileText
    }
    
    const IconComponent = icons[data.header.type as keyof typeof icons]
    return IconComponent ? createElement(IconComponent, { className: "h-3.5 w-3.5 text-gray-500" }) : null
  }

  return (
    <div
      ref={nodeRef}
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow transition-shadow min-w-[340px] max-w-[420px] group relative cursor-pointer",
        selected && "border-blue-500",
        hasMixedTypes && "border-red-200 dark:border-red-800",
        exceedsLimits && "border-orange-200 dark:border-orange-800"
      )}
      onClick={handleSelect}
      style={{ minHeight: totalActions > 0 ? 'auto' : '160px' }}
    >
      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-card/50">
        <div className={cn("w-7 h-7 rounded flex items-center justify-center", typeInfo.color.split(' ')[0])}>
          {createElement(TypeIcon, { className: "h-4 w-4" })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || typeInfo.label}
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <span>{typeInfo.subtitle}</span>
            {totalActions > 0 && (
              <>
                <span>•</span>
                <span>{totalActions} action{totalActions !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
        
        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleSelect}>
              Configure
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(id)}>
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete} 
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* WhatsApp Message Preview */}
      <div className="p-3">
        {totalActions > 0 ? (
          <div className="space-y-3">
            {/* WhatsApp Message Container */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              {/* Message Header */}
              {data.header?.content && (
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    {getHeaderIcon()}
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {getTruncatedText(data.header.content, 40)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {data.header.type.charAt(0).toUpperCase() + data.header.type.slice(1)}
                  </div>
                </div>
              )}

              {/* Message Body */}
              <div className="px-4 py-3">
                {data.body && (
                  <div className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                    {getTruncatedText(data.body, 120)}
                  </div>
                )}

                {/* Actions/Buttons Preview */}
                <div className="space-y-2 mt-3">
                  {data.actions.slice(0, isReplyButtons ? 3 : isQuickReplies ? 10 : isList ? 10 : 1).map((action, index) => {
                    const isAllowedType = getAllowedActionTypes().includes(action.type)
                    
                    return (
                      <div 
                        key={action.id}
                        ref={(el) => {
                          actionRefs.current[index] = el
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2.5 transition-all cursor-pointer",
                          isAllowedType ? getActionColor(action.type) : "bg-gray-300 hover:bg-gray-400",
                          !isAllowedType && "opacity-70"
                        )}
                        data-action-id={action.id}
                      >
                        <div className="flex items-center gap-2.5">
                          {getActionIcon(action.type)}
                          <div className="text-sm font-medium text-white truncate max-w-[180px]">
                            {action.title || `Action ${index + 1}`}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-white/80 px-2 py-1 bg-white/20 rounded">
                          {action.type.toUpperCase()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer */}
                {data.footer && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {getTruncatedText(data.footer, 60)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Badge */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.6 6.32C16.16 4.88 14.2 4 12 4C7.6 4 4 7.6 4 12C4 14.24 4.88 16.16 6.32 17.6L4 20L6.4 17.6C8.72 19.36 11.52 20 12 20C16.4 20 20 16.4 20 12C20 9.8 19.12 7.84 17.6 6.32ZM10.4 14.4L7.2 11.2L8.4 10L10.4 12L15.6 6.8L16.8 8L10.4 14.4Z"/>
                  </svg>
                </div>
                <span>WhatsApp Interactive</span>
              </div>
            </div>

            {/* Warnings */}
            {(hasMixedTypes || exceedsLimits) && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Warning: </span>
                    {hasMixedTypes ? 'Action type mismatch' : 'Exceeds WhatsApp limits'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-muted-foreground mb-2">
              {createElement(TypeIcon, { className: "h-8 w-8 mx-auto" })}
            </div>
            <div className="text-sm text-muted-foreground">
              Click to configure WhatsApp message
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {typeInfo.label}
            </div>
          </div>
        )}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-card"
        style={{ top: '50%' }}
      />

      {/* Output handles */}
      {data.actions
        .filter(action => action.type === 'reply')
        .slice(0, isReplyButtons ? 3 : isQuickReplies ? 10 : isList ? 10 : 0)
        .map((action, index) => {
          const topPosition = handlePositions[index] !== undefined ? handlePositions[index] : 50
        
          return (
            <Handle
              key={`action-${action.id}`}
              type="source"
              position={Position.Right}
              id={`action-${action.id}`}
              className="!w-2.5 !h-2.5 !bg-green-500 !border-2 !border-card"
              style={{ 
                top: `${topPosition}%`,
                right: '-5px'
              }}
            />
          )
        })}
    </div>
  )
}

export default memo(InteractiveMessageNode)