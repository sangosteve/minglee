// frontend/src/components/automations/nodes/MessageNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { DocumentTextIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { containsVariables } from '@/lib/system-variables';

interface MessageNodeData {
  label?: string;
  message?: string;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: any) => void;
  onSelect?: (id: string) => void;
}

const MessageNode = ({ data, id, selected }: NodeProps<MessageNodeData>) => {
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

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onSelect) {
      data.onSelect(id);
    }
  };

  const getTruncatedMessage = (message: string, maxLength: number = 80) => {
    if (!message) return "Click to edit...";
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group cursor-pointer",
        selected && "border-blue-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center dark:bg-blue-900/20">
          <DocumentTextIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Message"}
          </div>
          <div className="text-xs text-muted-foreground">
            {data.message ? `${data.message.length} chars` : "Empty"}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <EllipsisHorizontalIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem 
              onClick={handleSelect} 
              className="gap-2 text-foreground"
            >
              Edit message
            </DropdownMenuItem>
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
        <div className="text-sm text-muted-foreground break-words whitespace-pre-wrap line-clamp-3 mb-2">
          {getTruncatedMessage(data.message || "")}
        </div>
        
        {data.message && containsVariables(data.message) && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-blue-600 font-medium dark:text-blue-400">
                🔤 Personalization enabled
              </span>
            </div>
          </div>
        )}
        
        {data.message && (
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              {data.message.length} character{data.message.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-blue-600 font-medium dark:text-blue-400">
              Message
            </span>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-card !shadow-sm"
      />
    </div>
  );
};

export default MessageNode;