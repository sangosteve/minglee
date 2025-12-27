// frontend/src/components/automations/panels/MessagePanel.tsx
"use client"

import { useState, useEffect } from "react"
import { X, Variable, Eye, EyeOff, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Node } from "@xyflow/react"
import { 
  SYSTEM_VARIABLES, 
  VARIABLE_CATEGORIES, 
  resolveVariable,
  extractVariables 
} from "@/lib/system-variables"

interface MessagePanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

// Force convert to {{}} syntax regardless of what's in the label
const getVariableDisplay = (variableKey: string): string => {
  return `{{${variableKey}}}`
}

export default function MessagePanel({ node, onClose, onUpdate }: MessagePanelProps) {
  const [message, setMessage] = useState(node.data?.message || "")
  const [label, setLabel] = useState(node.data?.label || "Message")
  const [showPreview, setShowPreview] = useState(false)
  const [usedVariables, setUsedVariables] = useState<string[]>([])

  // Extract variables from message
  useEffect(() => {
    const variables = extractVariables(message)
    setUsedVariables(variables)
  }, [message])

  // Update node data when message changes
  useEffect(() => {
    onUpdate(node.id, {
      message,
      label,
      usedVariables,
      hasVariables: usedVariables.length > 0
    })
  }, [message, label, usedVariables, node.id, onUpdate])

  const insertVariable = (variableKey: string) => {
    // Use {{variable}} syntax
    const variable = `{{${variableKey}}}`
    setMessage(prev => prev + variable)
  }

  // Preview with sample data
  const getPreview = () => {
    const sampleContact = {
      name: "John Doe",
      first_name: "John",
      last_name: "Doe", 
      phone: "+1234567890",
      email: "john@example.com",
      city: "New York",
      country: "USA",
      status: "Active",
      tags: ["VIP", "Customer"]
    }
    
    const sampleUser = {
      name: "Jane Smith",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      companyName: "Our Company"
    }
    
    return resolveVariable(message, {
      contact: sampleContact,
      user: sampleUser,
      conversation: { id: "conv_123", status: "active", unreadCount: 0 }
    })
  }

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center dark:bg-blue-900/20">
            <Variable className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="font-semibold text-foreground">MESSAGE</h2>
          {usedVariables.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {usedVariables.length} variable{usedVariables.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Label */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Node Label
          </label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter a name for this message node..."
            className="bg-background"
          />
        </div>

        {/* Message Editor */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Message Content
          </label>
          
          {showPreview ? (
            <div className="border border-border rounded-lg p-3 bg-muted min-h-[120px]">
              <p className="text-sm whitespace-pre-wrap text-foreground">{getPreview()}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Preview with sample data
              </p>
            </div>
          ) : (
            <Textarea
              placeholder="Type your message here... Use {{variables}} for personalization"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] resize-none bg-background"
            />
          )}
        </div>

        {/* Used Variables */}
        {usedVariables.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Variables Used
            </label>
            <div className="flex flex-wrap gap-2">
              {usedVariables.map(variableKey => {
                return (
                  <Badge 
                    key={variableKey} 
                    variant="outline" 
                    className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                  >
                    <Variable className="h-3 w-3 mr-1" />
                    {getVariableDisplay(variableKey)}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Variable Picker */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Insert Variables
          </label>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-background border-border">
                <div className="flex items-center gap-2">
                  <Variable className="h-4 w-4" />
                  <span>Select a variable...</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto bg-card border-border">
              <DropdownMenuLabel className="text-foreground">Available Variables</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {VARIABLE_CATEGORIES.map(category => (
                <div key={category.key}>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground py-1">
                    {category.label}
                  </DropdownMenuLabel>
                  {SYSTEM_VARIABLES
                    .filter(v => v.category === category.key)
                    .map(variable => (
                      <DropdownMenuItem
                        key={variable.key}
                        onClick={() => insertVariable(variable.key)}
                        className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                      >
                        <Variable className="h-3 w-3 text-blue-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {getVariableDisplay(variable.key)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {variable.description}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}