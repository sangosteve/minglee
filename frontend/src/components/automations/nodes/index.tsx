import { NodeTypes } from '@xyflow/react';
import { memo } from 'react';
import TextMessageNode from './TextMessageNode';
import QuickRepliesNode from './QuickRepliesNode';
import TriggerNode from './TriggerNode'; // ADD THIS

export { TextMessageNode, QuickRepliesNode, TriggerNode }; // REMOVE StartNode

// Export node types for React Flow
export const nodeTypes = {
  // REMOVE THIS: startNode: StartNode,
  textMessageNode: TextMessageNode,
  quickRepliesNode: QuickRepliesNode,
  triggerNode: TriggerNode // ADD THIS
} as NodeTypes;