import * as React from "react";
import { X, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Tag {
  id: string;
  label: string;
  color?: string;
}

export interface TagSelectProps {
  /** Currently selected tag IDs */
  value: string[];
  /** Callback when selection changes */
  onChange: (value: string[]) => void;
  /** Available tags to select from */
  tags: Tag[];
  /** Callback when a new tag is created */
  onCreateTag?: (label: string) => Promise<Tag> | Tag;
  /** Placeholder text for the trigger button */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether the component is loading tags */
  isLoading?: boolean;
  /** Maximum number of tags that can be selected */
  maxTags?: number;
  /** Custom class name for the trigger */
  className?: string;
}

export function TagSelect({
  value,
  onChange,
  tags,
  onCreateTag,
  placeholder = "Select tags...",
  disabled = false,
  isLoading = false,
  maxTags,
  className,
}: TagSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  const selectedTags = React.useMemo(
    () => tags.filter((tag) => value.includes(tag.id)),
    [tags, value]
  );

  const availableTags = React.useMemo(
    () => tags.filter((tag) => !value.includes(tag.id)),
    [tags, value]
  );

  const canAddMore = maxTags === undefined || value.length < maxTags;

  const handleSelect = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else if (canAddMore) {
      onChange([...value, tagId]);
    }
  };

  const handleRemove = (tagId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(value.filter((id) => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !inputValue.trim() || isCreating) return;

    const existingTag = tags.find(
      (tag) => tag.label.toLowerCase() === inputValue.toLowerCase()
    );

    if (existingTag) {
      if (!value.includes(existingTag.id) && canAddMore) {
        onChange([...value, existingTag.id]);
      }
      setInputValue("");
      return;
    }

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(inputValue.trim());
      if (canAddMore) {
        onChange([...value, newTag.id]);
      }
      setInputValue("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim() && onCreateTag) {
      e.preventDefault();
      handleCreateTag();
    }
    if (e.key === "Backspace" && !inputValue && selectedTags.length > 0) {
      handleRemove(selectedTags[selectedTags.length - 1].id);
    }
  };

  const showCreateOption =
    onCreateTag &&
    inputValue.trim() &&
    !tags.some((tag) => tag.label.toLowerCase() === inputValue.toLowerCase()) &&
    canAddMore;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "min-h-10 h-auto w-full justify-start text-left font-normal hover:bg-transparent",
            !selectedTags.length && "text-muted-foreground",
            className
          )}
        >
          <div className="flex flex-wrap gap-1.5 items-center w-full">
            {selectedTags.length > 0 ? (
              selectedTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="shrink-0 gap-1 pr-1"
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
                  {tag.label}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-foreground/10 p-0.5 transition-colors"
                    onClick={(e) => handleRemove(tag.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRemove(tag.id);
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {tag.label}</span>
                  </button>
                </Badge>
              ))
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create tag..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading tags...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {showCreateOption ? null : "No tags found."}
                </CommandEmpty>

                {showCreateOption && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleCreateTag}
                        disabled={isCreating}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>
                          Create "{inputValue.trim()}"
                          {isCreating && "..."}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                    {availableTags.length > 0 && <CommandSeparator />}
                  </>
                )}

                {availableTags.length > 0 && (
                  <CommandGroup heading="Available">
                    {availableTags
                      .filter((tag) =>
                        tag.label
                          .toLowerCase()
                          .includes(inputValue.toLowerCase())
                      )
                      .map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.id}
                          onSelect={() => handleSelect(tag.id)}
                          disabled={!canAddMore}
                          className="gap-2"
                        >
                          <div
                            className="h-3 w-3 rounded-full border"
                            style={{
                              backgroundColor: tag.color || "hsl(var(--muted))",
                              borderColor:
                                tag.color || "hsl(var(--muted-foreground))",
                            }}
                          />
                          {tag.label}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}

                {selectedTags.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Selected">
                      {selectedTags
                        .filter((tag) =>
                          tag.label
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        )
                        .map((tag) => (
                          <CommandItem
                            key={tag.id}
                            value={tag.id}
                            onSelect={() => handleSelect(tag.id)}
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            <div
                              className="h-3 w-3 rounded-full border"
                              style={{
                                backgroundColor:
                                  tag.color || "hsl(var(--muted))",
                                borderColor:
                                  tag.color || "hsl(var(--muted-foreground))",
                              }}
                            />
                            {tag.label}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
