// frontend/src/components/automations/nodes/index.tsx
import { NodeTypes } from '@xyflow/react';
import { memo } from 'react';
import StartNode from './StartNode';
import TextMessageNode from './TextMessageNode';
import QuickRepliesNode from './QuickRepliesNode';
// import ListMessageNode from './ListMessageNode';
// import ConditionNode from './ConditionNode';
// import DelayNode from './DelayNode';
// import TagNode from './TagNode';

// Re-export all nodes
export { StartNode, TextMessageNode, QuickRepliesNode };

// Export node types for React Flow
export const nodeTypes = {
  startNode: StartNode,
  textMessageNode: TextMessageNode,
  quickRepliesNode: QuickRepliesNode
} as NodeTypes;