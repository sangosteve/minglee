// frontend/src/components/automations/nodes/QuickRepliesNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BoltIcon, EllipsisHorizontalIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { QuickReply } from '@/lib/api/quick-replies';

interface QuickRepliesNodeData {
  label?: string;
  quickReplyId?: string;
  quickReply?: QuickReply;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: any) => void;
  onSelect?: (id: string) => void;
}

const QuickRepliesNode = ({ data, id, selected }: NodeProps<QuickRepliesNodeData>) => {
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

  const getTruncatedText = (text: string, maxLength = 40) => {
    if (!text) return "Select a quick reply...";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const quickReply = data.quickReply;
  const hasMedia = quickReply?.mediaAttachmentIds?.length > 0 || quickReply?.mediaAttachments?.length > 0;

  return (
    <div 
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group cursor-pointer",
        selected && "border-purple-500 border-2"
      )}
      onClick={handleSelect}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center dark:bg-purple-900/20">
          <BoltIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Send Quick Reply"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {quickReply ? quickReply.name : "Not selected"}
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
              Edit quick reply
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
        <div className="space-y-2">
          {quickReply ? (
            <>
              <div className="text-sm text-foreground break-words whitespace-pre-wrap line-clamp-2">
                {getTruncatedText(quickReply.message)}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                    {quickReply.topics || "General"}
                  </span>
                  
                  {hasMedia && (
                    <div className="flex items-center gap-1">
                      <PaperClipIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {quickReply.mediaAttachmentIds?.length || quickReply.mediaAttachments?.length} file(s)
                      </span>
                    </div>
                  )}
                </div>
                
                <span className="text-xs text-muted-foreground">
                  {quickReply.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              Click to select a quick reply
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {quickReply ? "Ready to send" : "Not configured"}
          </span>
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            Quick Reply
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card !shadow-sm"
      />
    </div>
  );
};

export default QuickRepliesNode;