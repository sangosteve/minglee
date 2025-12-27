// frontend/src/components/automations/nodes/QuickRepliesNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ListBulletIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface QuickRepliesNodeData {
  label?: string;
  body?: string;
  buttons?: Array<{ id: string; text: string }>;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: any) => void;
}

const QuickRepliesNode = ({ data, id }: NodeProps<QuickRepliesNodeData>) => {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[Automation] Copy block:", id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[Automation] Duplicate block:", id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  const getTruncatedText = (text: string, maxLength = 40) => {
    if (!text) return "Click to edit...";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const hasButtons = data.buttons && data.buttons.length > 0;

  return (
    <div className="bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center dark:bg-purple-900/20">
          <ListBulletIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Quick Replies"}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <EllipsisHorizontalIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-foreground">
              Copy block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2 text-foreground">
              Duplicate block
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDelete} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="px-4 py-3">
        <div className="text-sm text-muted-foreground break-words whitespace-pre-wrap line-clamp-2 mb-2">
          {getTruncatedText(data.body || "")}
        </div>
        
        {hasButtons && (
          <div className="space-y-1 mt-2">
            {data.buttons!.slice(0, 3).map((button, index) => (
              <div
                key={button.id}
                className="flex items-center gap-2 text-xs bg-muted border border-border rounded px-2 py-1.5"
              >
                <span className="text-muted-foreground">#{index + 1}</span>
                <span className="text-foreground flex-1 truncate">{button.text}</span>
              </div>
            ))}
            {data.buttons!.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">+{data.buttons!.length - 3} more buttons</div>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {data.buttons?.length || 0} button{data.buttons?.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            Quick Replies
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
      />

      {data.buttons?.map((button, index) => (
        <Handle
          key={button.id}
          type="source"
          position={Position.Right}
          id={`button-${button.id}`}
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
          style={{
            top: `${30 + (index * 20)}%`,
          }}
        />
      ))}
    </div>
  );
};

export default QuickRepliesNode;