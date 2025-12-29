// frontend/components/automations/panels/TagPanel.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Check, Plus, Trash2, Tag, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import type { Node } from "@xyflow/react"
import { tagsApi } from "@/lib/api/tags"

interface TagPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

interface DatabaseTag {
  id: string
  name: string
  color: string
  description?: string
  count?: number
  contactCount?: number
}

export default function TagPanel({ node, onClose, onUpdate }: TagPanelProps) {
  const [action, setAction] = useState<'add' | 'remove' | 'toggle'>(node.data?.action || 'add')
  const [label, setLabel] = useState(node.data?.label || "")
  
  // Store BOTH IDs and Names
  const [tagIds, setTagIds] = useState<string[]>(node.data?.tagIds || [])
  const [tagNames, setTagNames] = useState<string[]>(node.data?.tagNames || [])
  
  const [newTag, setNewTag] = useState("")
  const [activeTab, setActiveTab] = useState("existing")
  
  // State for fetching tags
  const [existingTags, setExistingTags] = useState<DatabaseTag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debug log to see what we receive
  useEffect(() => {
    console.log('TagPanel - Node data received:', node.data)
    console.log('TagPanel - Current tagIds:', tagIds)
    console.log('TagPanel - Current tagNames:', tagNames)
  }, [])

  // Update node data when configuration changes
  const updateNodeData = useCallback(() => {
    const autoLabel = {
      add: 'Add Tags',
      remove: 'Remove Tags', 
      toggle: 'Toggle Tags'
    }[action]

    const data = {
      action,
      label: label || autoLabel,
      tagIds, // CRITICAL: Must include tagIds
      tagNames, // For display purposes
      tagCount: tagIds.length
    }

    console.log('TagPanel - Updating node with data:', data)
    onUpdate(node.id, data)
  }, [action, label, tagIds, tagNames, node.id, onUpdate])

  // Call updateNodeData when dependencies change
  useEffect(() => {
    updateNodeData()
  }, [action, label, tagIds, tagNames, updateNodeData])

  // Fetch existing tags from database
  useEffect(() => {
    fetchExistingTags()
  }, [])

  const fetchExistingTags = async () => {
    setIsLoadingTags(true)
    setError(null)
    
    try {
      const response = await tagsApi.getAll()
      console.log('Fetched tags:', response)
      setExistingTags(response)
    } catch (error: any) {
      console.error('Error fetching tags:', error)
      setError(error.message || 'Failed to load tags')
    } finally {
      setIsLoadingTags(false)
    }
  }

  const addTag = async () => {
    const tagName = newTag.trim()
    if (!tagName) return

    if (activeTab === "manual") {
      // For manual entry, generate temporary ID and add to arrays
      if (!tagNames.includes(tagName)) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        setTagIds(prev => [...prev, tempId])
        setTagNames(prev => [...prev, tagName])
        setNewTag("")
        console.log('Added manual tag:', { id: tempId, name: tagName })
      }
    } else if (activeTab === "create") {
      // Create new tag in database
      try {
        const createdTag = await tagsApi.create({ 
          name: tagName,
          color: getRandomColor()
        })
        console.log('Created tag:', createdTag)
        
        // Add to selected tags
        setTagIds(prev => [...prev, createdTag.id])
        setTagNames(prev => [...prev, createdTag.name])
        setNewTag("")
        
        // Refresh tags list
        fetchExistingTags()
      } catch (error: any) {
        console.error('Failed to create tag:', error)
        setError(error.message || 'Failed to create tag')
      }
    }
  }

  const removeTag = (tagId: string, tagName: string) => {
    console.log('Removing tag:', { tagId, tagName })
    setTagIds(prev => prev.filter(id => id !== tagId))
    setTagNames(prev => prev.filter(name => name !== tagName))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const handleExistingTagClick = (tag: DatabaseTag) => {
    console.log('Clicked existing tag:', tag)
    
    if (tagIds.includes(tag.id)) {
      // Remove tag
      removeTag(tag.id, tag.name)
    } else {
      // Add tag
      setTagIds(prev => [...prev, tag.id])
      setTagNames(prev => [...prev, tag.name])
    }
  }

  // Helper to generate random color
  const getRandomColor = (): string => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // Debug display of current state
  const debugInfo = () => {
    return (
      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
        <div className="font-medium">Debug Info:</div>
        <div>Tag IDs: {tagIds.length > 0 ? tagIds.join(', ') : 'None'}</div>
        <div>Tag Names: {tagNames.length > 0 ? tagNames.join(', ') : 'None'}</div>
      </div>
    )
  }

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center dark:bg-green-900/20">
            <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="font-semibold text-foreground">TAG CONTACT</h2>
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
        {/* Node Label */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Node Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter descriptive name..."
            className="bg-background"
          />
        </div>

        {/* Action Type */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-3 block">
            Tag Action
          </Label>
          <RadioGroup 
            value={action} 
            onValueChange={(value) => setAction(value as any)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="add" id="add" />
              <Label htmlFor="add" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center dark:bg-green-900/20">
                    <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium">Add Tags</div>
                    <div className="text-xs text-muted-foreground">
                      Adds tags to the contact. Existing tags remain.
                    </div>
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="remove" id="remove" />
              <Label htmlFor="remove" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center dark:bg-red-900/20">
                    <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="font-medium">Remove Tags</div>
                    <div className="text-xs text-muted-foreground">
                      Removes tags from the contact. Other tags remain.
                    </div>
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="toggle" id="toggle" />
              <Label htmlFor="toggle" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center dark:bg-blue-900/20">
                    <Tag className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium">Toggle Tags</div>
                    <div className="text-xs text-muted-foreground">
                      Adds if not present, removes if present.
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Selected Tags Display */}
        {tagIds.length > 0 && (
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Selected Tags ({tagIds.length})
            </Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
              {tagNames.map((name, index) => (
                <Badge 
                  key={tagIds[index]}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 flex items-center gap-1"
                >
                  #{name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-transparent"
                    onClick={() => removeTag(tagIds[index], name)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* DEBUG INFO - Remove this in production */}
        {debugInfo()}

        {/* Tag Input */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="existing">Existing Tags</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>
          
          {/* EXISTING TAGS TAB */}
          <TabsContent value="existing" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Select from Existing Tags
              </Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={fetchExistingTags}
                disabled={isLoadingTags}
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingTags ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {isLoadingTags ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 rounded-md dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : existingTags.length === 0 ? (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  No tags created yet. Go to "Create New" tab to create your first tag.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2">
                {existingTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={tagIds.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-90 transition-all"
                    style={{ 
                      backgroundColor: tagIds.includes(tag.id) ? tag.color : undefined,
                      borderColor: tag.color,
                      color: tagIds.includes(tag.id) ? 'white' : tag.color
                    }}
                    onClick={() => handleExistingTagClick(tag)}
                  >
                    #{tag.name}
                    {tag.contactCount && tag.contactCount > 0 && (
                      <span className="ml-1 text-xs opacity-75">
                        ({tag.contactCount})
                      </span>
                    )}
                    {tagIds.includes(tag.id) && (
                      <Check className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* CREATE NEW TAB */}
          <TabsContent value="create" className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Create New Tag
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter new tag name"
                  className="flex-1 bg-background"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={addTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tag will be saved to your database and available for all automations.
              </p>
            </div>
          </TabsContent>
          
          {/* MANUAL ENTRY TAB */}
          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Enter Tags (temporary)
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type tag name and press Enter"
                  className="flex-1 bg-background"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={addTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: Manual tags will be created in the database during execution.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Example */}
        <div className="p-3 bg-muted rounded-md">
          <div className="text-xs font-medium text-foreground mb-1">Example:</div>
          <div className="text-xs text-muted-foreground">
            When this node executes, it will {action} the tags: 
            {tagNames.slice(0, 3).map(tag => ` #${tag}`).join(',')}
            {tagNames.length > 3 && ` and ${tagNames.length - 3} more`}
            {tagNames.length === 0 && ' (no tags configured)'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Node ID: {node.id}</span>
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-500" />
            {tagIds.length} tag{tagIds.length !== 1 ? 's' : ''} configured
          </span>
        </div>
      </div>
    </div>
  )
}