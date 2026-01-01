// frontend/src/components/automations/nodes/index.tsx
import { NodeTypes } from '@xyflow/react';
import TextMessageNode from './TextMessageNode';
import QuickRepliesNode from './QuickRepliesNode';
import ConditionNode from './ConditionNode';
import TriggerNode from './TriggerNode';
import TagNode from './TagNode';
import MediaMessageNode from './MediaMessageNode';
import KeywordActionNode from './KeywordActionNode'; // Add this


// Export individual nodes
export { 
  TextMessageNode, 
  QuickRepliesNode, 
  TriggerNode, 
  MediaMessageNode,
  TagNode,
  ConditionNode,
  KeywordActionNode, // Add this
};

// Export node types for React Flow
export const nodeTypes = {
  textMessageNode: TextMessageNode,
  quickRepliesNode: QuickRepliesNode,
  triggerNode: TriggerNode,
  tagNode: TagNode,
  conditionNode: ConditionNode,
  mediaMessageNode: MediaMessageNode,
  keywordActionNode: KeywordActionNode, // Add this
} as NodeTypes;