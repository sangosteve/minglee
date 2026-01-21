// frontend/src/components/chat/TemplateSelectDialog.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { useApprovedTemplates, type Template } from "@/lib/api/templates";

interface TemplateSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Template) => void;
}

export function TemplateSelectDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplateSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: templates = [], isLoading } = useApprovedTemplates();

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...new Set(templates.map(t => t.category).filter(Boolean))];

  const getCategoryLabel = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'MARKETING': return 'Marketing';
      case 'UTILITY': return 'Utility';
      case 'AUTHENTICATION': return 'Authentication';
      default: return category || 'Other';
    }
  };

  const hasVariables = (template: Template) => {
    const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
    return bodyComponent?.text?.includes('{{') || bodyComponent?.example?.body_text_named_params?.length > 0;
  };

  const hasMedia = (template: Template) => {
    const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
    return headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
        </DialogHeader>

        {/* Search and Filter */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="capitalize"
              >
                {getCategoryLabel(cat)}
              </Button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No templates found</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onSelectTemplate(template);
                  onOpenChange(false);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground truncate">
                          {template.name.replace(/_/g, " ")}
                        </h4>
                        <Badge variant="outline" className="capitalize">
                          {getCategoryLabel(template.category || '')}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.components?.find((c: any) => c.type === 'BODY')?.text || "No body content"}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {template.language}
                        </span>
                        {hasVariables(template) && (
                          <Badge variant="secondary" className="text-xs">
                            Has Variables
                          </Badge>
                        )}
                        {hasMedia(template) && (
                          <Badge variant="secondary" className="text-xs">
                            Has Media
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant={
                      template.status === 'approved' ? 'default' : 
                      template.status === 'pending' ? 'outline' : 
                      'secondary'
                    }>
                      {template.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}