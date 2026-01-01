// frontend/src/components/automations/panels/KeywordActionPanel.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import type { Node } from "@xyflow/react"

// Hugeicons imports
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MultiplicationSignIcon,
  KeyboardIcon,
  GridIcon,
  PlusSignCircleIcon,
  Search01Icon,
  TextFontIcon,
  AlertCircleIcon,
  AlignLeftIcon,
  AlignHorizontalCenterIcon,
} from "@hugeicons/core-free-icons"

interface KeywordActionPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

export default function KeywordActionPanel({ node, onClose, onUpdate }: KeywordActionPanelProps) {
  const [keywords, setKeywords] = useState<string[]>(node.data?.keywords || [])
  const [newKeyword, setNewKeyword] = useState("")
  const [matchType, setMatchType] = useState<'exact' | 'contains' | 'startsWith' | 'endsWith'>(
    node.data?.matchType || 'contains'
  )
  const [caseSensitive, setCaseSensitive] = useState<boolean>(
    node.data?.caseSensitive || false
  )
  const [matchAll, setMatchAll] = useState<boolean>(
    node.data?.matchAll || false
  )
  const [label, setLabel] = useState(node.data?.label || "Check Keywords")
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredKeywords, setFilteredKeywords] = useState<string[]>([])
  
  const { toast } = useToast()

  // Initialize filtered keywords
  useEffect(() => {
    setFilteredKeywords(
      keywords.filter(keyword => 
        keyword.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [keywords, searchQuery])

  // Update node data when configuration changes
  useEffect(() => {
    const nodeData = {
      label,
      keywords,
      matchType,
      caseSensitive,
      matchAll,
    }
    onUpdate(node.id, nodeData)
  }, [label, keywords, matchType, caseSensitive, matchAll, node.id, onUpdate])

  const handleAddKeyword = () => {
    const trimmedKeyword = newKeyword.trim()
    
    if (!trimmedKeyword) {
      toast({
        title: "Empty keyword",
        description: "Please enter a keyword",
        variant: "destructive",
      })
      return
    }
    
    if (keywords.includes(trimmedKeyword)) {
      toast({
        title: "Duplicate keyword",
        description: "This keyword already exists",
        variant: "destructive",
      })
      return
    }
    
    if (keywords.length >= 50) {
      toast({
        title: "Too many keywords",
        description: "Maximum 50 keywords allowed",
        variant: "destructive",
      })
      return
    }
    
    const updatedKeywords = [...keywords, trimmedKeyword]
    setKeywords(updatedKeywords)
    setNewKeyword("")
    
    toast({
      title: "Keyword added",
      description: `"${trimmedKeyword}" added to keywords list`,
    })
  }

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const updatedKeywords = keywords.filter(k => k !== keywordToRemove)
    setKeywords(updatedKeywords)
  }

  const handleClearAll = () => {
    if (keywords.length === 0) return
    
    if (!confirm(`Are you sure you want to remove all ${keywords.length} keywords?`)) {
      return
    }
    
    setKeywords([])
    
    toast({
      title: "Keywords cleared",
      description: "All keywords have been removed",
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddKeyword()
    }
  }

  const getMatchTypeDescription = (type: string) => {
    switch (type) {
      case 'exact':
        return "Message must exactly match the keyword";
      case 'contains':
        return "Message must contain the keyword anywhere";
      case 'startsWith':
        return "Message must start with the keyword";
      case 'endsWith':
        return "Message must end with the keyword";
      default:
        return "";
    }
  }

  const getExampleText = () => {
    if (keywords.length === 0) return "Add keywords to see example"
    
    const sampleKeyword = keywords[0]
    const logicText = matchAll ? "ALL of" : "ANY of"
    const caseText = caseSensitive ? "case-sensitive" : "case-insensitive"
    
    return `If message ${matchType} ${logicText} the keywords (${caseText})`
  }

  const getPreviewResult = () => {
    if (keywords.length === 0) return null
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={PlusSignCircleIcon} size={14} className="text-green-500" />
            <span className="text-xs font-medium text-green-600">Match Branch</span>
          </div>
          <span className="text-xs text-muted-foreground">→ Follows if keywords are found</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={MultiplicationSignIcon} size={14} className="text-red-500" />
            <span className="text-xs font-medium text-red-600">No-match Branch</span>
          </div>
          <span className="text-xs text-muted-foreground">→ Follows if no keywords are found</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center dark:bg-amber-900/20">
            <HugeiconsIcon 
              icon={KeyboardIcon} 
              size={16} 
              className="text-amber-600 dark:text-amber-400" 
            />
          </div>
          <h2 className="font-semibold text-foreground">KEYWORD CHECK</h2>
          {keywords.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {keywords.length}
            </Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-accent" 
          onClick={onClose}
        >
          <HugeiconsIcon icon={MultiplicationSignIcon} size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Node Label */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Node Label
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter node label..."
              className="bg-background border-input"
            />
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-3 block">
                Matching Settings
              </Label>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Match Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">
                    Match Type
                  </Label>
                  <Select value={matchType} onValueChange={(value: any) => setMatchType(value)}>
                    <SelectTrigger className="bg-background border-input h-9">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={GridIcon} size={14} className="text-muted-foreground" />
                        <SelectValue placeholder="Select type" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="startsWith">Starts With</SelectItem>
                      <SelectItem value="endsWith">Ends With</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Match Logic */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">
                    Match Logic
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={matchAll ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => setMatchAll(true)}
                    >
                      <HugeiconsIcon icon={AlignLeftIcon} size={14} className="mr-2" />
                      All
                    </Button>
                    <Button
                      type="button"
                      variant={!matchAll ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => setMatchAll(false)}
                    >
                      <HugeiconsIcon icon={AlignHorizontalCenterIcon} size={14} className="mr-2" />
                      Any
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {getMatchTypeDescription(matchType)} {matchAll ? "(ALL required)" : "(ANY will trigger)"}
              </div>
            </div>

            {/* Case Sensitivity */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {caseSensitive ? (
                    <HugeiconsIcon icon={TextFontIcon} size={16} className="text-amber-500" />
                  ) : (
                    <HugeiconsIcon icon={TextFontIcon} size={16} className="text-blue-500" />
                  )}
                  <Label className="text-sm font-medium text-foreground">
                    Case Sensitive
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {caseSensitive 
                    ? "'Hello' ≠ 'hello'" 
                    : "'Hello' = 'hello' = 'HELLO'"}
                </p>
              </div>
              <Switch
                checked={caseSensitive}
                onCheckedChange={setCaseSensitive}
              />
            </div>
          </div>

          {/* Add Keywords */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Add Keywords
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-background border-input"
              />
              <Button 
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                className="gap-2"
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} size={16} />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add to add keyword
            </p>
          </div>

          {/* Keyword List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Keywords ({keywords.length}/50)
              </Label>
              {keywords.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Search Keywords */}
            {keywords.length > 5 && (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <HugeiconsIcon icon={Search01Icon} size={16} className="text-muted-foreground" />
                </div>
                <Input
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-input"
                />
              </div>
            )}

            <ScrollArea className="h-[180px]">
              {keywords.length === 0 ? (
                <div className="text-center py-8">
                  <HugeiconsIcon 
                    icon={GridIcon} 
                    size={32} 
                    className="text-muted-foreground mx-auto mb-2" 
                  />
                  <p className="text-sm text-muted-foreground">No keywords added</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add keywords to check for in messages
                  </p>
                </div>
              ) : filteredKeywords.length === 0 ? (
                <div className="text-center py-8">
                  <HugeiconsIcon 
                    icon={Search01Icon} 
                    size={32} 
                    className="text-muted-foreground mx-auto mb-2" 
                  />
                  <p className="text-sm text-muted-foreground">No matching keywords</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredKeywords.map((keyword, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon 
                          icon={GridIcon} 
                          size={14} 
                          className="text-muted-foreground" 
                        />
                        <span className="font-medium text-sm text-foreground">
                          "{keyword}"
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <HugeiconsIcon icon={MultiplicationSignIcon} size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Example & Preview */}
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2 mb-1">
                <HugeiconsIcon 
                  icon={AlertCircleIcon} 
                  size={16} 
                  className="text-amber-500 flex-shrink-0 mt-0.5" 
                />
                <p className="font-medium">Example</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {getExampleText()}
              </p>
            </div>

            {getPreviewResult()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {keywords.length > 0 
              ? `${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} configured`
              : "No keywords configured"}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={onClose}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}