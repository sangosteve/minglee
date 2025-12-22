// frontend/src/components/contacts/ContactFilter.tsx
import React, { useState, useEffect } from "react";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ContactFilters, Tag } from "@/lib/api/contacts";
import { CheckIcon } from "@heroicons/react/24/solid";

interface ContactFilterProps {
  filters: ContactFilters;
  onFilterChange: (filters: ContactFilters) => void;
  availableTags?: Tag[];
}

export const ContactFilter: React.FC<ContactFilterProps> = ({
  filters,
  onFilterChange,
  availableTags = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags || []);

  // Reset when filters change
  useEffect(() => {
    setSelectedTags(filters.tags || []);
  }, [filters.tags]);

  // Status options
  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "active", label: "Active", color: "text-success" },
    { value: "inactive", label: "Inactive", color: "text-muted-foreground" },
    { value: "lead", label: "Lead", color: "text-blue-500" },
    { value: "customer", label: "Customer", color: "text-purple-500" },
    { value: "blocked", label: "Blocked", color: "text-destructive" },
    { value: "archived", label: "Archived", color: "text-gray-500" },
  ];

  const handleApplyFilter = () => {
    const newFilters: ContactFilters = {
      ...filters,
      page: 1,
    };

    // Handle tags filter - ensure it's an array
    if (selectedTags.length > 0) {
      newFilters.tags = selectedTags;
    } else {
      // Remove tags filter if empty
      const { tags, ...rest } = newFilters;
      onFilterChange(rest);
      setIsOpen(false);
      return;
    }

    console.log("Applying filters with tags:", newFilters.tags);
    onFilterChange(newFilters);
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    setSelectedTags([]);
    
    // Remove all filter properties
    const { status, tags, city, country, ...rest } = filters;
    onFilterChange({ ...rest, page: 1 });
    setIsOpen(false);
  };

  const handleTagToggle = (tagId: string) => {
    console.log("Toggling tag:", tagId);
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleClearTags = () => {
    setSelectedTags([]);
  };

  const handleStatusChange = (statusValue: string) => {
    const newFilters = { ...filters, page: 1 };
    if (statusValue) {
      newFilters.status = statusValue;
    } else {
      const { status, ...rest } = newFilters;
      onFilterChange(rest);
      return;
    }
    onFilterChange(newFilters);
  };

  const hasActiveFilters = Boolean(
    filters.status || 
    (filters.tags && filters.tags.length > 0) || 
    filters.city || 
    filters.country
  );

  const activeFilterCount = [
    filters.status ? 1 : 0,
    filters.tags?.length || 0,
    filters.city ? 1 : 0,
    filters.country ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  console.log("Available tags in filter:", availableTags);
  console.log("Selected tags:", selectedTags);

  return (
    <div className="relative">
      {/* Filter Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative",
          hasActiveFilters && "border-primary bg-primary/5"
        )}
      >
        <FunnelIcon className="w-4 h-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {/* Filter Dialog */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Filter Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-card rounded-lg border border-border shadow-lg">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">Filter Contacts</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-secondary rounded"
                >
                  <XMarkIcon className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Status
                </label>
                <div className="space-y-1">
                  {statusOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                        filters.status === option.value
                          ? "bg-secondary text-foreground"
                          : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {option.value && (
                          <div className={cn("w-2 h-2 rounded-full", option.color)} />
                        )}
                        <span>{option.label}</span>
                      </div>
                      {filters.status === option.value && (
                        <CheckIcon className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Tags Filter */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Tags
                  </label>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={handleClearTags}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No tags available
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                      {availableTags.map((tag: any) => {
                        // Handle different tag object structures
                        const tagId = tag.id || tag._id || tag.value;
                        const tagName = tag.name || tag.label || tag.title || "Unnamed Tag";
                        const tagColor = tag.color || "#6b7280";
                        
                        if (!tagId) return null;
                        
                        return (
                          <Badge
                            key={tagId}
                            variant={selectedTags.includes(tagId) ? "default" : "outline"}
                            className="cursor-pointer gap-1.5"
                            onClick={() => handleTagToggle(tagId)}
                            style={{
                              backgroundColor: selectedTags.includes(tagId) 
                                ? tagColor 
                                : `${tagColor}15`,
                              color: selectedTags.includes(tagId) 
                                ? 'white'
                                : tagColor,
                              borderColor: `${tagColor}30`
                            }}
                          >
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: tagColor }}
                            />
                            {tagName}
                          </Badge>
                        );
                      })}
                    </div>
                    {selectedTags.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClearFilter}
                  disabled={!hasActiveFilters}
                >
                  Clear All
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleApplyFilter}
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-card rounded-lg border border-border p-3 shadow-lg z-40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Active Filters:</span>
            <button
              onClick={handleClearFilter}
              className="text-xs text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.status && (
              <Badge 
                variant="secondary" 
                className="text-xs gap-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                Status: {statusOptions.find(s => s.value === filters.status)?.label}
              </Badge>
            )}
            {filters.tags && filters.tags.length > 0 && availableTags && (
              <>
                {filters.tags.map(tagId => {
                  // Find the tag in availableTags
                  const tag = availableTags.find((t: any) => 
                    (t.id === tagId) || (t._id === tagId) || (t.value === tagId)
                  );
                  const tagName = tag?.name || tag?.label || tagId;
                  const tagColor = tag?.color || "#6b7280";
                  
                  return (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className="text-xs gap-1"
                      style={{
                        backgroundColor: `${tagColor}20`,
                        color: tagColor,
                        borderColor: `${tagColor}30`
                      }}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: tagColor }}
                      />
                      {tagName}
                    </Badge>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};