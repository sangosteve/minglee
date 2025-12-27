// frontend/src/components/automations/nodes/index.tsx
import { NodeTypes } from '@xyflow/react';
import { memo } from 'react';
import StartNode from './StartNode';
import MessageNode from './MessageNode';
import QuickRepliesNode from './QuickRepliesNode';
// import ListMessageNode from './ListMessageNode';
// import ConditionNode from './ConditionNode';
// import DelayNode from './DelayNode';
// import TagNode from './TagNode';

// Re-export all nodes
export { StartNode, MessageNode, QuickRepliesNode };

// Export node types for React Flow
export const nodeTypes = {
  startNode: StartNode,
  messageNode: MessageNode,
  quickRepliesNode: QuickRepliesNode
} as NodeTypes;