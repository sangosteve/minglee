// frontend/src/components/templates/TemplateCard.tsx - UPDATED
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Copy, 
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Ban
} from "lucide-react";
import { Template } from "@/lib/api/templates";
import { format } from "date-fns";

interface TemplateCardProps {
  template: Template;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
}

export function TemplateCard({ 
  template, 
  onView, 
  onEdit, 
  onDelete, 
  onDuplicate,
  onSend 
}: TemplateCardProps) {
  const getStatusIcon = () => {
    switch (template.status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'disabled':
        return <Ban className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (template.status) {
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'disabled':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return '';
    }
  };

  // Find body component for preview
  const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
  const bodyText = bodyComponent?.text || '';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground capitalize">
              {template.name.replace(/_/g, ' ')}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={`text-xs gap-1 ${getStatusColor()}`}>
                {getStatusIcon()}
                {template.status}
              </Badge>
              {template.category && (
                <Badge variant="outline" className="text-xs">
                  {template.category}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {template.status === 'approved' && (
                <DropdownMenuItem onClick={onSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Body Preview */}
        {bodyText && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {bodyText.replace(/\{\{[^}]*\}\}/g, '[variable]')}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Language: {template.language || 'en'}</span>
            {template.createdAt && (
              <span>
                {format(new Date(template.createdAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {template.metaTemplateId && (
            <Badge variant="outline" className="text-xs">
              Meta ID: {template.metaTemplateId.substring(0, 8)}...
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}