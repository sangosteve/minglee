// frontend/src/components/automations/nodes/index.tsx
import { NodeTypes } from '@xyflow/react';
import TextMessageNode from './TextMessageNode';
import QuickRepliesNode from './QuickRepliesNode';
import ConditionNode from './ConditionNode';
import TriggerNode from './TriggerNode'; // ADD THIS
import TagNode from './TagNode';
import MediaMessageNode from './MediaMessageNode'
export { TextMessageNode, QuickRepliesNode, TriggerNode, MediaMessageNode }; // REMOVE StartNode

// Export node types for React Flow
export const nodeTypes = {
  // REMOVE THIS: startNode: StartNode,
  textMessageNode: TextMessageNode,
  quickRepliesNode: QuickRepliesNode,
  triggerNode: TriggerNode ,
  tagNode: TagNode,
  conditionNode:ConditionNode,
  mediaMessageNode: MediaMessageNode,
} as NodeTypes;