// frontend/src/components/automations/panels/QuickRepliesPanel.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import type { Node } from "@xyflow/react"
import type { QuickReply } from "@/lib/api/quick-replies"
import { quickRepliesApi } from "@/lib/api/quick-replies"

// Hugeicons imports
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MultiplicationSignIcon,
  ZapIcon,
  EyeIcon,
  ViewOffIcon,
  Search01Icon,
  Attachment02Icon,
  File01Icon,
  Tag01Icon,
  PlusSignCircleIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

// Import the CreateSnippetDialog
import { CreateSnippetDialog } from "@/components/settings/CreateSnippetDialog"

interface QuickRepliesPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

export default function QuickRepliesPanel({ node, onClose, onUpdate }: QuickRepliesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReply[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedQuickReply, setSelectedQuickReply] = useState<QuickReply | null>(
    node.data?.quickReply || null
  )
  const [showPreview, setShowPreview] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewMessage, setPreviewMessage] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  const { toast } = useToast()

  // Load quick replies
  const loadQuickReplies = async () => {
    try {
      setIsLoading(true)
      const response = await quickRepliesApi.getQuickReplies({
        page: 1,
        limit: 100,
        isActive: true,
      })

      if (response.success) {
        setQuickReplies(response.quickReplies)
        setFilteredQuickReplies(response.quickReplies)
      }
    } catch (error) {
      console.error("Failed to load quick replies:", error)
      toast({
        title: "Error",
        description: "Failed to load quick replies",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadTopics = async () => {
    try {
      const response = await quickRepliesApi.getTopics()
      if (response.success) {
        setTopics(response.topics)
      }
    } catch (error) {
      console.error("Failed to load topics:", error)
    }
  }

  // Initial load
  useEffect(() => {
    loadQuickReplies()
    loadTopics()
  }, [])

  // Load filtered quick replies when search or filter changes
  useEffect(() => {
    if (!quickReplies.length) return

    let filtered = quickReplies

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(reply => 
        reply.name.toLowerCase().includes(searchLower) ||
        reply.message.toLowerCase().includes(searchLower) ||
        reply.topics.toLowerCase().includes(searchLower)
      )
    }

    if (topicFilter !== "all") {
      filtered = filtered.filter(reply => 
        reply.topics.toLowerCase().includes(topicFilter.toLowerCase())
      )
    }

    setFilteredQuickReplies(filtered)
  }, [quickReplies, searchQuery, topicFilter])

  // Update preview when quick reply changes
  useEffect(() => {
    if (selectedQuickReply) {
      // For now, just show the raw message
      // In a real implementation, you'd want to show personalized preview
      setPreviewMessage(selectedQuickReply.message)
    }
  }, [selectedQuickReply])

  const handleSelectQuickReply = (quickReply: QuickReply) => {
    setSelectedQuickReply(quickReply)
    
    // Update node data
    onUpdate(node.id, {
      label: "Send Quick Reply",
      quickReplyId: quickReply.id,
      quickReply: quickReply,
    })
  }

  const handleCreateNewSuccess = () => {
    // Refresh the quick replies list when a new one is created
    loadQuickReplies()
    loadTopics()
  }

  const getMediaDisplay = (reply: QuickReply) => {
    const mediaCount = reply.mediaAttachmentIds?.length || reply.mediaAttachments?.length || 0
    if (mediaCount > 0) {
      return (
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={Attachment02Icon} size={12} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{mediaCount} file(s)</span>
        </div>
      )
    }
    return null
  }

  return (
    <>
      <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg h-full">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center dark:bg-purple-900/20">
              <HugeiconsIcon 
                icon={ZapIcon} 
                size={16} 
                className="text-purple-600 dark:text-purple-400" 
              />
            </div>
            <h2 className="font-semibold text-foreground">SEND QUICK REPLY</h2>
            {selectedQuickReply && (
              <Badge variant="secondary" className="ml-2">
                Selected
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
              {showPreview ? (
                <HugeiconsIcon icon={ViewOffIcon} size={16} />
              ) : (
                <HugeiconsIcon icon={EyeIcon} size={16} />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-accent" 
              onClick={onClose}
            >
              <HugeiconsIcon icon={MultiplicationSignIcon} size={16} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Selected Quick Reply Preview */}
            {selectedQuickReply && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Selected Quick Reply
                  </label>
                  
                  {showPreview ? (
                    <div className="border border-border rounded-lg p-3 bg-muted">
                      <p className="text-sm whitespace-pre-wrap text-foreground">{previewMessage}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {getMediaDisplay(selectedQuickReply)}
                        <Badge variant="outline" className="text-xs">
                          {selectedQuickReply.topics}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Preview (variables not resolved)
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg p-3 bg-background">
                      <h3 className="font-medium text-foreground mb-1">
                        {selectedQuickReply.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {selectedQuickReply.message.length > 100 
                          ? selectedQuickReply.message.substring(0, 100) + "..."
                          : selectedQuickReply.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getMediaDisplay(selectedQuickReply)}
                          <Badge variant="outline" className="text-xs">
                            {selectedQuickReply.topics}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedQuickReply(null)}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <HugeiconsIcon icon={Search01Icon} size={16} className="text-muted-foreground" />
                </div>
                <Input
                  placeholder="Search quick replies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger className="bg-background border-input">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Tag01Icon} size={16} className="text-muted-foreground" />
                      <SelectValue placeholder="Filter by Topic" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <CreateSnippetDialog 
                  onSuccess={handleCreateNewSuccess}
                  trigger={
                    <Button variant="outline" className="border-input w-full">
                      <HugeiconsIcon icon={PlusSignCircleIcon} size={16} className="mr-2" />
                      Create New
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Quick Replies List */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Available Quick Replies
              </label>
              
              <ScrollArea className="h-[300px]">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredQuickReplies.length === 0 ? (
                  <div className="text-center py-8">
                    <HugeiconsIcon 
                      icon={File01Icon} 
                      size={32} 
                      className="text-muted-foreground mx-auto mb-2" 
                    />
                    <p className="text-sm text-muted-foreground">No quick replies found</p>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredQuickReplies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                          selectedQuickReply?.id === reply.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-border"
                        }`}
                        onClick={() => handleSelectQuickReply(reply)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">
                              {reply.name}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {reply.message}
                            </p>
                          </div>
                          {reply.mediaAttachmentIds?.length > 0 && (
                            <HugeiconsIcon 
                              icon={Attachment02Icon} 
                              size={16} 
                              className="text-muted-foreground ml-2 flex-shrink-0" 
                            />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            <HugeiconsIcon icon={Tag01Icon} size={12} className="mr-1" />
                            {reply.topics}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {reply.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Info Note */}
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2 mb-1">
                <HugeiconsIcon 
                  icon={AlertCircleIcon} 
                  size={16} 
                  className="text-blue-500 flex-shrink-0 mt-0.5" 
                />
                <p className="font-medium">How Quick Replies Work</p>
              </div>
              <ul className="space-y-1 pl-6">
                <li className="list-disc">Messages will be personalized with contact information</li>
                <li className="list-disc">Media attachments will be included automatically</li>
                <li className="list-disc">Only active quick replies are shown</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedQuickReply
                ? `"${selectedQuickReply.name}" selected`
                : "No quick reply selected"}
            </div>
            <Button 
              variant="default" 
              onClick={onClose}
              disabled={!selectedQuickReply}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}