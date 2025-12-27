// frontend/src/components/automations/nodes/ConditionNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FunnelIcon, EllipsisHorizontalIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ConditionNodeData {
  label?: string;
  rules?: ConditionRule[];
  logic?: 'all' | 'any';
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: any) => void;
}

const ConditionNode = ({ data, id }: NodeProps<ConditionNodeData>) => {
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

  const rules = data.rules || [];
  const logic = data.logic || 'all';

  return (
    <div className="bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[200px] max-w-[320px] group">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-amber-100 rounded flex items-center justify-center dark:bg-amber-900/20">
          <FunnelIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "Condition"}
          </div>
          {rules.length > 0 && (
            <div className="text-xs text-muted-foreground truncate">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} • {logic === 'all' ? 'All must match' : 'Any can match'}
            </div>
          )}
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
        {rules.length === 0 ? (
          <div className="text-center py-4 border-2 border-dashed border-border rounded-lg">
            <FunnelIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No conditions added</p>
            <p className="text-xs text-muted-foreground mt-1">Add rules to create branching logic</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.slice(0, 2).map((rule, index) => (
              <div key={rule.id} className="text-xs bg-muted border border-border rounded p-2">
                <div className="font-medium text-foreground mb-1">Rule {index + 1}</div>
                <div className="text-muted-foreground truncate">
                  {rule.field} {rule.operator} {rule.value}
                </div>
              </div>
            ))}
            {rules.length > 2 && (
              <div className="text-xs text-muted-foreground text-center">
                +{rules.length - 2} more rule{rules.length - 2 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {logic === 'all' ? 'All conditions' : 'Any condition'}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Condition
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-card !shadow-sm"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm"
        style={{ top: '30%' }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-card !shadow-sm"
        style={{ top: '70%' }}
      />
    </div>
  );
};

export default ConditionNode;