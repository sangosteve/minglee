// components/automations/panels/TriggerPanel.tsx
"use client"

import { useState, useEffect } from "react"
import { X, Check, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Node } from "@xyflow/react"
import { TRIGGER_TYPES, type TriggerType } from "@/components/automations/nodes/TriggerNode"

interface TriggerPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

export default function TriggerPanel({ node, onClose, onUpdate }: TriggerPanelProps) {
  const [triggerType, setTriggerType] = useState<TriggerType>(node.data?.triggerType || 'new_conversation')
  const [label, setLabel] = useState(node.data?.label || "")
  const [keywords, setKeywords] = useState<string[]>(node.data?.config?.keywords || [])
  const [newKeyword, setNewKeyword] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(node.data?.config?.caseSensitive || false)
  const [matchAll, setMatchAll] = useState(node.data?.config?.matchAll || false)

  // Update node data when configuration changes
  useEffect(() => {
    const config = {
      keywords: triggerType === 'keyword' ? keywords : undefined,
      caseSensitive: triggerType === 'keyword' ? caseSensitive : undefined,
      matchAll: triggerType === 'keyword' ? matchAll : undefined
    }

    onUpdate(node.id, {
      triggerType,
      label: label || TRIGGER_TYPES.find(t => t.id === triggerType)?.label,
      config
    })
  }, [triggerType, label, keywords, caseSensitive, matchAll, node.id, onUpdate])

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword("")
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(k => k !== keywordToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  const selectedTrigger = TRIGGER_TYPES.find(t => t.id === triggerType)

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center dark:bg-green-900/20">
            <span className="text-sm">{selectedTrigger?.icon}</span>
          </div>
          <h2 className="font-semibold text-foreground">TRIGGER</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-accent" 
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Trigger Label */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Trigger Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter a descriptive name for this trigger..."
            className="bg-background"
          />
        </div>

        {/* Trigger Type */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-3 block">
            Trigger Type
          </Label>
          <RadioGroup 
            value={triggerType} 
            onValueChange={(value) => setTriggerType(value as TriggerType)}
            className="space-y-3"
          >
            {TRIGGER_TYPES.map((trigger) => (
              <div key={trigger.id} className="flex items-center space-x-2">
                <RadioGroupItem value={trigger.id} id={trigger.id} />
                <Label htmlFor={trigger.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{trigger.icon}</span>
                    <div>
                      <div className="font-medium">{trigger.label}</div>
                      <div className="text-xs text-muted-foreground">{trigger.description}</div>
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Keyword Configuration (only for keyword trigger) */}
        {triggerType === 'keyword' && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Keywords to Match
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a keyword and press Enter"
                  className="flex-1 bg-background"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={addKeyword}
                  disabled={!newKeyword.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((keyword, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary"
                      className="pl-2 pr-1 py-1 flex items-center gap-1"
                    >
                      "{keyword}"
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-transparent"
                        onClick={() => removeKeyword(keyword)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic mt-2">
                  No keywords added yet. Add keywords to trigger this automation.
                </div>
              )}
            </div>

            {/* Keyword Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="case-sensitive" className="text-sm font-medium">
                  Case Sensitive
                </Label>
                <Switch
                  id="case-sensitive"
                  checked={caseSensitive}
                  onCheckedChange={setCaseSensitive}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="match-all" className="text-sm font-medium">
                  Match All Keywords
                  <div className="text-xs text-muted-foreground font-normal">
                    When checked, all keywords must match. When unchecked, any keyword will trigger.
                  </div>
                </Label>
                <Switch
                  id="match-all"
                  checked={matchAll}
                  onCheckedChange={setMatchAll}
                />
              </div>
            </div>

            {/* Example */}
            <div className="p-3 bg-muted rounded-md">
              <div className="text-xs font-medium text-foreground mb-1">Example:</div>
              <div className="text-xs text-muted-foreground">
                {caseSensitive ? 'Case sensitive: ' : 'Case insensitive: '}
                If someone messages "{keywords.slice(0, 2).join('" or "')}"
                {matchAll ? ' (all required)' : ' (any will trigger)'}
              </div>
            </div>
          </div>
        )}

        {/* Trigger Description */}
        {triggerType === 'new_conversation' && (
          <div className="p-3 bg-blue-50 rounded-md dark:bg-blue-900/20">
            <div className="text-xs font-medium text-foreground mb-1">How it works:</div>
            <div className="text-xs text-muted-foreground">
              This trigger will activate when a contact sends their first-ever message to your WhatsApp number.
              Perfect for welcome messages and initial qualification.
            </div>
          </div>
        )}

        {triggerType === 'message_received' && (
          <div className="p-3 bg-blue-50 rounded-md dark:bg-blue-900/20">
            <div className="text-xs font-medium text-foreground mb-1">How it works:</div>
            <div className="text-xs text-muted-foreground">
              This trigger will activate on EVERY message received. Use carefully as it can create loops.
              Best combined with conditions or used for simple auto-replies.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Trigger ID: {node.id}</span>
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-500" />
            Configured
          </span>
        </div>
      </div>
    </div>
  )
}