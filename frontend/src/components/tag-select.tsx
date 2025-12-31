"use client"

import * as React from "react"
import { X, Plus, Check, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface Tag {
  id: string
  label: string
  color?: string
}

export interface CustomTagSelectProps {
  /** Currently selected tag IDs */
  value: string[]
  /** Callback when selection changes */
  onChange: (value: string[]) => void
  /** Available tags to select from */
  tags: Tag[]
  /** Callback when a new tag is created */
  onCreateTag?: (label: string) => Promise<Tag> | Tag
  /** Placeholder text for the trigger button */
  placeholder?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Whether the component is loading tags */
  isLoading?: boolean
  /** Maximum number of tags that can be selected */
  maxTags?: number
  /** Custom class name for the trigger */
  className?: string
}

export function CustomTagSelect({
  value,
  onChange,
  tags,
  onCreateTag,
  placeholder = "Select tags...",
  disabled = false,
  isLoading = false,
  maxTags,
  className,
}: CustomTagSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedTags = React.useMemo(
    () => tags.filter((tag) => value.includes(tag.id)),
    [tags, value]
  )

  const availableTags = React.useMemo(
    () => tags.filter((tag) => !value.includes(tag.id)),
    [tags, value]
  )

  const canAddMore = maxTags === undefined || value.length < maxTags

  const handleSelect = (tagId: string) => {
    if (isLoading || disabled) return; // Prevent interaction while loading
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId))
    } else if (canAddMore) {
      onChange([...value, tagId])
    }
    // Keep dropdown open for multiple selections
  }

  const handleRemove = (tagId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isLoading || disabled) return; // Prevent interaction while loading
    onChange(value.filter((id) => id !== tagId))
  }

  const handleCreateTag = async () => {
    if (isLoading || disabled || !onCreateTag || !searchQuery.trim() || isCreating) return

    const existingTag = tags.find(
      (tag) => tag.label.toLowerCase() === searchQuery.toLowerCase()
    )

    if (existingTag) {
      if (!value.includes(existingTag.id) && canAddMore) {
        onChange([...value, existingTag.id])
      }
      setSearchQuery("")
      return
    }

    setIsCreating(true)
    try {
      const newTag = await onCreateTag(searchQuery.trim())
      if (canAddMore) {
        onChange([...value, newTag.id])
      }
      setSearchQuery("")
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLoading || disabled) return; // Prevent interaction while loading
    
    if (e.key === "Enter" && searchQuery.trim() && onCreateTag) {
      e.preventDefault()
      handleCreateTag()
    }
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const showCreateOption =
    onCreateTag &&
    searchQuery.trim() &&
    !tags.some((tag) => tag.label.toLowerCase() === searchQuery.toLowerCase()) &&
    canAddMore &&
    !isLoading && // Don't show create option while loading
    !disabled // Don't show create option while disabled

  // Filter tags based on search
  const filteredAvailableTags = availableTags.filter((tag) =>
    tag.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSelectedTags = selectedTags.filter((tag) =>
    tag.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Prevent opening dropdown while loading
  const handleTriggerClick = () => {
    if (disabled || isLoading) {
      return;
    }
    setIsOpen(!isOpen);
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled || isLoading}
        className={cn(
          "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "text-left",
          className
        )}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 overflow-hidden">
          {isLoading ? (
            <span className="text-muted-foreground italic">Loading tags...</span>
          ) : selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="shrink-0 gap-1 pr-1 max-w-full"
                style={
                  tag.color
                    ? {
                        backgroundColor: `${tag.color}20`,
                        borderColor: tag.color,
                        color: tag.color,
                      }
                    : undefined
                }
              >
                <span className="truncate">{tag.label}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-foreground/10 p-0.5 transition-colors"
                  onClick={(e) => handleRemove(tag.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleRemove(tag.id)
                    }
                  }}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {tag.label}</span>
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Loading tags..." : placeholder}
            </span>
          )}
        </div>
        <svg
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
            (disabled || isLoading) && "opacity-50"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && !isLoading && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search or create tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 bg-background"
                autoFocus
                disabled={disabled}
              />
            </div>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading tags...
              </div>
            ) : (
              <>
                {/* Create option */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isCreating || disabled}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      Create "{searchQuery.trim()}"
                      {isCreating && "..."}
                    </span>
                  </button>
                )}

                {/* Available tags */}
                {filteredAvailableTags.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Available
                    </div>
                    {filteredAvailableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleSelect(tag.id)}
                        disabled={!canAddMore || disabled}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{
                            backgroundColor: tag.color || "hsl(var(--muted))",
                            borderColor: tag.color || "hsl(var(--muted-foreground))",
                          }}
                        />
                        {tag.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected tags */}
                {filteredSelectedTags.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Selected
                    </div>
                    {filteredSelectedTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleSelect(tag.id)}
                        disabled={disabled}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="h-4 w-4" />
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{
                            backgroundColor: tag.color || "hsl(var(--muted))",
                            borderColor: tag.color || "hsl(var(--muted-foreground))",
                          }}
                        />
                        {tag.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results */}
                {!showCreateOption && 
                 filteredAvailableTags.length === 0 && 
                 filteredSelectedTags.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {searchQuery ? "No tags found" : "No tags available"}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-2 text-xs text-muted-foreground flex justify-between">
            <span>
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </span>
            {maxTags && (
              <span>
                Max: {maxTags}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}