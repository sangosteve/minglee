// frontend/src/components/automations/panels/TextMessagePanel.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { X, Variable, Eye, EyeOff, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Node } from "@xyflow/react"
import {
  SYSTEM_VARIABLES,
  VARIABLE_CATEGORIES,
  resolveVariable,
  extractVariables
} from "@/lib/system-variables"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface TextMessagePanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

// Force convert to {{}} syntax regardless of what's in the label
const getVariableDisplay = (variableKey: string): string => {
  return `{{${variableKey}}}`
}

export default function TextMessagePanel({ node, onClose, onUpdate }: TextMessagePanelProps) {
  const [message, setMessage] = useState(node.data?.message || "")
  const [showPreview, setShowPreview] = useState(false)
  const [usedVariables, setUsedVariables] = useState<string[]>([])
  const [isVariablePopoverOpen, setIsVariablePopoverOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Extract variables from message
  useEffect(() => {
    const variables = extractVariables(message)
    setUsedVariables(variables)
  }, [message])

  // Update node data when message changes
  useEffect(() => {
    onUpdate(node.id, {
      message,
      usedVariables,
      hasVariables: usedVariables.length > 0
    })
  }, [message, usedVariables, node.id, onUpdate])

  // Handle textarea changes and detect $
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)
    
    // Get cursor position
    const cursorPos = e.target.selectionStart
    setCursorPosition(cursorPos)
    
    // Check if user just typed $ and open popover
    if (cursorPos > 0 && value[cursorPos - 1] === '$') {
      setIsVariablePopoverOpen(true)
      setSearchQuery("")
      // Focus search input after popover opens
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 100)
    }
  }

  // Insert variable at cursor position
  const insertVariableAtCursor = (variableKey: string) => {
    if (!textareaRef.current) return

    const variable = `{{${variableKey}}}`
    const textarea = textareaRef.current
    
    // Replace $ at cursor position with variable
    const beforeCursor = message.substring(0, cursorPosition - 1) // Remove the $
    const afterCursor = message.substring(cursorPosition)
    const newMessage = beforeCursor + variable + afterCursor
    
    setMessage(newMessage)
    setIsVariablePopoverOpen(false)
    setSearchQuery("")
    
    // Focus back on textarea and set cursor position after variable
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeCursor.length + variable.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 10)
  }

  // Handle keydown in textarea to close popover with Escape
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && isVariablePopoverOpen) {
      setIsVariablePopoverOpen(false)
    }
  }

  // Handle keydown in search input to insert variable with Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredVariables.length > 0) {
      e.preventDefault()
      insertVariableAtCursor(filteredVariables[0].key)
    }
    if (e.key === 'Escape') {
      setIsVariablePopoverOpen(false)
      textareaRef.current?.focus()
    }
  }

  // Filter variables based on search
  const filteredVariables = SYSTEM_VARIABLES.filter(variable =>
    variable.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    variable.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group filtered variables by category
  const groupedVariables = VARIABLE_CATEGORIES.map(category => ({
    ...category,
    variables: filteredVariables.filter(v => v.category === category.key)
  })).filter(group => group.variables.length > 0)

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
          <h2 className="font-semibold text-foreground">TEXT MESSAGE</h2>
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
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="Type your message here... Press $ to insert variables"
                value={message}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                onClick={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
                onKeyUp={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
                className="min-h-[120px] resize-none bg-background pr-10"
                autoFocus
              />
              <div className="absolute right-2 top-2">
                <Popover open={isVariablePopoverOpen} onOpenChange={setIsVariablePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-accent"
                      onClick={() => {
                        setIsVariablePopoverOpen(true)
                        setTimeout(() => {
                          if (searchInputRef.current) {
                            searchInputRef.current.focus()
                          }
                        }, 100)
                      }}
                    >
                      <Variable className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80 p-0 bg-card border-border shadow-lg" 
                    align="end"
                    sideOffset={5}
                    onEscapeKeyDown={() => {
                      setIsVariablePopoverOpen(false)
                      textareaRef.current?.focus()
                    }}
                  >
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Search variables..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          className="pl-8 bg-background"
                          autoFocus
                        />
                      </div>
                    </div>
                    
                    <ScrollArea className="h-64">
                      {groupedVariables.length > 0 ? (
                        groupedVariables.map(group => (
                          <div key={group.key} className="p-2">
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              {group.label}
                            </div>
                            {group.variables.map(variable => (
                              <button
                                key={variable.key}
                                onClick={() => insertVariableAtCursor(variable.key)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-sm"
                              >
                                <Variable className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-foreground truncate">
                                    {getVariableDisplay(variable.key)}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {variable.description}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">
                          No variables found matching "{searchQuery}"
                        </div>
                      )}
                    </ScrollArea>
                    
                    <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                      <span>Type $ in text to open this menu</span>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Enter</kbd>
                        <span>to select</span>
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border ml-2">Esc</kbd>
                        <span>to close</span>
                      </span>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
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
                    className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/40"
                    onClick={() => {
                      // Focus textarea and move cursor to end for editing
                      if (textareaRef.current) {
                        textareaRef.current.focus()
                        textareaRef.current.setSelectionRange(message.length, message.length)
                      }
                    }}
                  >
                    <Variable className="h-3 w-3 mr-1" />
                    {getVariableDisplay(variableKey)}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Variable Instructions */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <Variable className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-foreground">Insert Variables</h4>
              <p className="text-xs text-muted-foreground">
                Type <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">$</kbd> anywhere in your message 
                to open the variable picker, or click the <Variable className="h-3 w-3 inline" /> icon.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Variables will be replaced with actual data when sent to contacts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}