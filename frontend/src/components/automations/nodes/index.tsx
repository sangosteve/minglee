import { NodeTypes } from '@xyflow/react';
import { memo } from 'react';
import TextMessageNode from './TextMessageNode';
import QuickRepliesNode from './QuickRepliesNode';
import ConditionNode from './ConditionNode';
import TriggerNode from './TriggerNode'; // ADD THIS
import TagNode from './TagNode';
export { TextMessageNode, QuickRepliesNode, TriggerNode }; // REMOVE StartNode

// Export node types for React Flow
export const nodeTypes = {
  // REMOVE THIS: startNode: StartNode,
  textMessageNode: TextMessageNode,
  quickRepliesNode: QuickRepliesNode,
  triggerNode: TriggerNode ,
  tagNode: TagNode,
  conditionNode:ConditionNode
} as NodeTypes;