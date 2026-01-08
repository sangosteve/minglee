// frontend/src/components/automations/panels/InteractiveMessagePanel.tsx
import { useState, useEffect, useRef, createElement } from "react"
import { 
  X, Plus, Trash2, MessageSquare, ChevronUp, ChevronDown, 
  AlertCircle, List,
  Check,
  Image as ImageIcon,
  Video,
  FileText,
  Type
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Node } from "@xyflow/react"
import { cn } from "@/lib/utils"

interface InteractiveMessageData {
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
  label?: string
}

interface InteractiveMessagePanelProps {
  node: Node<InteractiveMessageData>
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

export default function InteractiveMessagePanel({ node, onUpdate, onClose }: InteractiveMessagePanelProps) {
  // State initialization
  const [label, setLabel] = useState(node.data?.label || "")
  const [type, setType] = useState(node.data?.type || 'reply_buttons')
  const [headerType, setHeaderType] = useState(node.data?.header?.type || 'text')
  const [headerContent, setHeaderContent] = useState(node.data?.header?.content || "")
  const [body, setBody] = useState(node.data?.body || "")
  const [footer, setFooter] = useState(node.data?.footer || "")
  const [actions, setActions] = useState(node.data?.actions || [])
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Get type info
  const getTypeInfo = (type: string) => {
    const typeMap = {
      'reply_buttons': { 
        label: 'Reply Buttons',
        icon: MessageSquare,
        color: 'bg-purple-500',
        description: '1-3 buttons, full-width display, creates conversation branches'
      },
      'quick_replies': { 
        label: 'Quick Replies',
        icon: MessageSquare,
        color: 'bg-amber-500',
        description: '4-10 buttons, pill-shaped, for multiple choice responses'
      },
      'list': { 
        label: 'List Message',
        icon: List,
        color: 'bg-green-500',
        description: 'Sections with up to 10 options total'
      },
      'url_button': { 
        label: 'URL Button',
        icon: MessageSquare,
        color: 'bg-blue-500',
        description: 'Single button that opens link in browser (no reply)'
      },
      'call_button': { 
        label: 'Call Button',
        icon: MessageSquare,
        color: 'bg-red-500',
        description: 'Single button that initiates phone call (no reply)'
      }
    }
    return typeMap[type as keyof typeof typeMap] || typeMap.reply_buttons
  }

  const typeInfo = getTypeInfo(type)
  const TypeIcon = typeInfo.icon

  // Auto-save function
  const saveChanges = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const updateData = {
        label: label.trim() || undefined,
        type,
        header: headerContent ? {
          type: headerType,
          content: headerContent
        } : undefined,
        body,
        footer,
        actions
      }
      
      onUpdate(node.id, updateData)
      setLastSaved(new Date())
    }, 300)
  }

  // Save on changes
  useEffect(() => {
    saveChanges()
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [label, type, headerType, headerContent, body, footer, actions])

  // Type change handler
  const handleTypeChange = (newType: typeof type) => {
    const currentActions = [...actions]
    let filteredActions = [...currentActions]
    
    switch (newType) {
      case 'reply_buttons':
        filteredActions = currentActions
          .filter(action => action.type === 'reply')
          .slice(0, 3)
          .map((action, index) => ({
            ...action,
            title: action.title || `Button ${index + 1}`,
            payload: action.payload || `button_${index + 1}`
          }))
        break
      case 'quick_replies':
        filteredActions = currentActions
          .filter(action => action.type === 'reply')
          .slice(0, 10)
          .map((action, index) => ({
            ...action,
            title: action.title || `Reply ${index + 1}`,
            payload: action.payload || `reply_${index + 1}`
          }))
        break
      case 'url_button':
        const urlAction = currentActions.find(a => a.type === 'url')
        filteredActions = urlAction 
          ? [urlAction]
          : [{
              id: `action-${Date.now()}`,
              type: 'url' as const,
              title: 'Visit Website',
              url: 'https://example.com'
            }]
        break
      case 'call_button':
        const callAction = currentActions.find(a => a.type === 'call')
        filteredActions = callAction 
          ? [callAction]
          : [{
              id: `action-${Date.now()}`,
              type: 'call' as const,
              title: 'Call Now',
              phoneNumber: '+1234567890'
            }]
        break
      case 'list':
        filteredActions = currentActions.slice(0, 10)
        break
    }
    
    setType(newType)
    setActions(filteredActions)
  }

  // Add action
  const addAction = () => {
    const maxActions = {
      'reply_buttons': 3,
      'quick_replies': 10,
      'list': 10,
      'url_button': 1,
      'call_button': 1
    }
    
    if (actions.length >= maxActions[type]) return
    
    let newAction: any = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'reply' as const,
      title: ''
    }
    
    switch (type) {
      case 'reply_buttons':
        newAction.title = `Button ${actions.length + 1}`
        newAction.payload = `button_${actions.length + 1}`
        break
      case 'quick_replies':
        newAction.title = `Reply ${actions.length + 1}`
        newAction.payload = `reply_${actions.length + 1}`
        break
      case 'list':
        newAction.title = `Option ${actions.length + 1}`
        newAction.payload = `option_${actions.length + 1}`
        break
      case 'url_button':
        newAction = {
          id: `action-${Date.now()}`,
          type: 'url' as const,
          title: 'Visit Website',
          url: 'https://example.com'
        }
        break
      case 'call_button':
        newAction = {
          id: `action-${Date.now()}`,
          type: 'call' as const,
          title: 'Call Now',
          phoneNumber: '+1234567890'
        }
        break
    }
    
    setActions(prev => [...prev, newAction])
  }

  // Update action
  const updateAction = (actionId: string, field: string, value: string) => {
    setActions(prev => 
      prev.map(action => 
        action.id === actionId 
          ? { ...action, [field]: value }
          : action
      )
    )
  }

  // Remove action
  const removeAction = (actionId: string) => {
    setActions(prev => prev.filter(action => action.id !== actionId))
  }

  // Move action
  const moveAction = (fromIndex: number, toIndex: number) => {
    const newActions = [...actions]
    const [movedAction] = newActions.splice(fromIndex, 1)
    newActions.splice(toIndex, 0, movedAction)
    setActions(newActions)
  }

  // Get allowed action types
  const getAllowedActionTypes = () => {
    switch (type) {
      case 'reply_buttons':
      case 'quick_replies':
        return ['reply']
      case 'url_button':
        return ['url']
      case 'call_button':
        return ['call']
      case 'list':
        return ['reply', 'url', 'call']
      default:
        return ['reply']
    }
  }

  const maxActions = type === 'reply_buttons' ? 3 : 
                    type === 'quick_replies' ? 10 : 
                    type === 'list' ? 10 : 1

  // Get header icon component
  const getHeaderIcon = () => {
    const icons = {
      'text': Type,
      'image': ImageIcon,
      'video': Video,
      'document': FileText
    }
    
    const IconComponent = icons[headerType as keyof typeof icons]
    return IconComponent ? createElement(IconComponent, { className: "h-3.5 w-3.5" }) : null
  }

  // Get action color for preview
  const getActionColor = (actionType: string) => {
    const colors = {
      'reply': 'bg-[#0086EA]',
      'url': 'bg-[#25D366]',
      'call': 'bg-[#25D366]'
    }
    return colors[actionType as keyof typeof colors] || 'bg-[#0086EA]'
  }

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-7 h-7 rounded flex items-center justify-center", typeInfo.color)}>
              {createElement(TypeIcon, { className: "h-4 w-4 text-white" })}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Interactive Message</h2>
              <div className="text-xs text-muted-foreground">
                {typeInfo.label}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <Badge variant="secondary">
            {actions.length}/{maxActions} actions
          </Badge>
          {lastSaved && (
            <div className="text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Label */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-1.5 block">
            Node Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Custom label for node..."
            className="bg-background border-border h-8"
          />
        </div>

        {/* Type */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-1.5 block">
            Message Type
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={type === 'reply_buttons' ? 'default' : 'outline'}
              className={cn("h-9 justify-start", type === 'reply_buttons' && "bg-purple-600 hover:bg-purple-700")}
              onClick={() => handleTypeChange('reply_buttons')}
            >
              Reply Buttons
            </Button>
            <Button
              variant={type === 'quick_replies' ? 'default' : 'outline'}
              className={cn("h-9 justify-start", type === 'quick_replies' && "bg-amber-600 hover:bg-amber-700")}
              onClick={() => handleTypeChange('quick_replies')}
            >
              Quick Replies
            </Button>
            <Button
              variant={type === 'url_button' ? 'default' : 'outline'}
              className={cn("h-9 justify-start", type === 'url_button' && "bg-blue-600 hover:bg-blue-700")}
              onClick={() => handleTypeChange('url_button')}
            >
              URL Button
            </Button>
            <Button
              variant={type === 'call_button' ? 'default' : 'outline'}
              className={cn("h-9 justify-start", type === 'call_button' && "bg-red-600 hover:bg-red-700")}
              onClick={() => handleTypeChange('call_button')}
            >
              Call Button
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {typeInfo.description}
          </p>
        </div>

        {/* Header */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-1.5 block">
            Header (Optional)
          </Label>
          <div className="space-y-2">
            <Select value={headerType} onValueChange={(value: any) => setHeaderType(value)}>
              <SelectTrigger className="h-8 text-sm bg-background border-border">
                <SelectValue placeholder="Header type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text" className="text-sm">
                  Text Header
                </SelectItem>
                <SelectItem value="image" className="text-sm">
                  Image Header
                </SelectItem>
                <SelectItem value="video" className="text-sm">
                  Video Header
                </SelectItem>
                <SelectItem value="document" className="text-sm">
                  Document Header
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder={headerType === 'text' ? "Header text..." : "Caption or description..."}
              value={headerContent}
              onChange={(e) => setHeaderContent(e.target.value)}
              maxLength={headerType === 'text' ? 60 : 1024}
              className="h-8 text-sm bg-background border-border"
            />
          </div>
        </div>

        {/* Body */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-1.5 block">
            Message Body
          </Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your main message..."
            className="min-h-[80px] text-sm resize-none bg-background border-border"
            maxLength={1024}
          />
        </div>

        {/* Footer */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-1.5 block">
            Footer (Optional)
          </Label>
          <Input
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Footer text..."
            maxLength={60}
            className="bg-background border-border h-8"
          />
        </div>

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-foreground">
              Actions
            </Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addAction}
              disabled={actions.length >= maxActions}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Action
            </Button>
          </div>

          {actions.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed border-border rounded">
              No actions configured
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action, index) => {
                const isAllowedType = getAllowedActionTypes().includes(action.type)
                
                return (
                  <div
                    key={action.id}
                    className={cn(
                      "border rounded p-3",
                      !isAllowedType && "border-red-200 bg-red-50"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Action Type and Title */}
                      <div className="flex gap-2">
                        <div className="w-32">
                          <Select
                            value={action.type}
                            onValueChange={(value: any) => updateAction(action.id, 'type', value)}
                            disabled={type === 'url_button' || type === 'call_button'}
                          >
                            <SelectTrigger className="h-8 text-sm w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reply" className="text-sm">
                                Reply
                              </SelectItem>
                              <SelectItem value="url" className="text-sm">
                                URL
                              </SelectItem>
                              <SelectItem value="call" className="text-sm">
                                Call
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex-1">
                          <Input
                            value={action.title}
                            onChange={(e) => updateAction(action.id, 'title', e.target.value)}
                            placeholder="Button text (sent to WhatsApp)"
                            maxLength={20}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAction(action.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      
                      {/* Action-specific fields */}
                      {action.type === 'reply' && (
                        <Input
                          value={action.payload || ''}
                          onChange={(e) => updateAction(action.id, 'payload', e.target.value)}
                          placeholder="Reply payload (for automation)"
                          className="h-8 text-sm"
                        />
                      )}
                      
                      {action.type === 'url' && (
                        <Input
                          value={action.url || ''}
                          onChange={(e) => updateAction(action.id, 'url', e.target.value)}
                          placeholder="https://example.com"
                          className="h-8 text-sm"
                        />
                      )}
                      
                      {action.type === 'call' && (
                        <Input
                          value={action.phoneNumber || ''}
                          onChange={(e) => updateAction(action.id, 'phoneNumber', e.target.value)}
                          placeholder="+1234567890"
                          className="h-8 text-sm"
                        />
                      )}
                      
                      {/* Error message */}
                      {!isAllowedType && (
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          <span>
                            {type === 'reply_buttons' || type === 'quick_replies'
                              ? 'Only REPLY actions allowed for this type'
                              : type === 'url_button'
                                ? 'Only URL actions allowed for this type'
                                : 'Only CALL actions allowed for this type'
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* WhatsApp Preview */}
        <div className="pt-4 border-t border-border">
          <Label className="text-sm font-medium text-foreground mb-3 block">
            WhatsApp Preview
          </Label>
          
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            {/* Header Preview */}
            {headerContent && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  {getHeaderIcon()}
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {headerContent.length > 40 ? `${headerContent.substring(0, 40)}...` : headerContent}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {headerType.charAt(0).toUpperCase() + headerType.slice(1)} Header
                </div>
              </div>
            )}

            {/* Body Preview */}
            <div className="px-4 py-3">
              {body && (
                <div className="text-sm text-gray-800 dark:text-gray-200 mb-3">
                  {body.length > 100 ? `${body.substring(0, 100)}...` : body}
                </div>
              )}

              {/* Actions Preview */}
              {actions.length > 0 && (
                <div className="space-y-2">
                  {actions.slice(0, 3).map((action, idx) => (
                    <div 
                      key={action.id} 
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2.5",
                        getActionColor(action.type),
                        "text-white"
                      )}
                    >
                      <div className="text-sm font-medium truncate max-w-[180px]">
                        {action.title || `Action ${idx + 1}`}
                      </div>
                      <div className="text-xs font-medium px-2 py-1 bg-white/20 rounded">
                        {action.type.toUpperCase()}
                      </div>
                    </div>
                  ))}
                  {actions.length > 3 && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-1">
                      + {actions.length - 3} more actions
                    </div>
                  )}
                </div>
              )}

              {/* Footer Preview */}
              {footer && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {footer.length > 50 ? `${footer.substring(0, 50)}...` : footer}
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Branding */}
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6 6.32C16.16 4.88 14.2 4 12 4C7.6 4 4 7.6 4 12C4 14.24 4.88 16.16 6.32 17.6L4 20L6.4 17.6C8.72 19.36 11.52 20 12 20C16.4 20 20 16.4 20 12C20 9.8 19.12 7.84 17.6 6.32ZM10.4 14.4L7.2 11.2L8.4 10L10.4 12L15.6 6.8L16.8 8L10.4 14.4Z"/>
                    </svg>
                  </div>
                  <span>WhatsApp Interactive</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}