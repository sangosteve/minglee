// frontend/src/pages/automations/AutomationEditor.tsx
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  useReactFlow,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PaperAirplaneIcon,
  ListBulletIcon,
  Squares2X2Icon,
  FunnelIcon,
  PlayIcon,
  PauseIcon,
  BoltIcon,
  ArrowLeftIcon,
  TrashIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { nodeTypes } from "@/components/automations/nodes";
import TextMessagePanel from "@/components/automations/panels/TextMessagePanel";
import TriggerPanel from "@/components/automations/panels/TriggerPanel";
import TagPanel from "@/components/automations/panels/TagPanel";
import {
  useAutomation,
  useUpdateAutomation,
  useUpdateAutomationStatus
} from "@/lib/api/automations";
import { api } from "@/lib/api";
import ConditionPanel from "@/components/automations/panels/ConditionPanel";
import MediaMessagePanel from "@/components/automations/panels/MediaMessagePanel";
import QuickRepliesPanel from "@/components/automations/panels/QuickRepliesPanel";

// Default edge options
const defaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: "#3b82f6",
  },
  style: {
    strokeWidth: 2,
    stroke: "#3b82f6",
  },
};

function AutomationEditorInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeId, setNodeId] = useState(2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    messages: true,
    logic: true,
    actions: true,
  });
  const [workflowName, setWorkflowName] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<"draft" | "active" | "paused">("draft");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionPopup, setConnectionPopup] = useState({
    show: false,
    position: { x: 0, y: 0 },
    sourceNodeId: null as string | null,
    sourceHandleId: null as string | null,
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Query hooks
  const { data: automation, isLoading: isLoadingAutomation, refetch } = useAutomation(id!);
  const updateAutomationMutation = useUpdateAutomation();
  const updateStatusMutation = useUpdateAutomationStatus();

  // Load automation data
  useEffect(() => {
    if (automation) {
      console.log('🔍 Loading automation from backend:', automation);
      console.log('🔍 Available keys:', Object.keys(automation));

      setWorkflowName(automation.name);
      setWorkflowStatus(automation.status);

      let loadedNodes: Node[] = [];
      let loadedEdges: Edge[] = [];

      // Check for flow data in both camelCase and snake_case
      const flowData = automation.flowData || automation.flow_data;

      if (flowData) {
        console.log('📦 Found flow data:', flowData);
        loadedNodes = flowData.nodes || [];
        loadedEdges = flowData.edges || [];

        console.log('📦 Loaded nodes from DB:', loadedNodes);
        console.log('📦 Loaded edges from DB:', loadedEdges);

        // Check if we have a triggerNode, if not add one
        const hasTriggerNode = loadedNodes.some((node: Node) => node.type === 'triggerNode');
        if (!hasTriggerNode && loadedNodes.length > 0) {
          console.log('➕ Adding missing triggerNode...');

          const triggerNode: Node = {
            id: `trigger-${Date.now()}`,
            type: 'triggerNode',
            position: { x: 100, y: 100 },
            data: {
              triggerType: 'new_conversation',
              label: 'Trigger',
              config: {},
              onDelete: undefined,
              onUpdate: updateNode,
            },
          };
          loadedNodes.unshift(triggerNode);
        }

        // Add onDelete and onUpdate functions to all nodes
        const nodesWithCallbacks = loadedNodes.map((node: Node) => ({
          ...node,
          data: {
            ...node.data,
            onDelete: node.type === "triggerNode" ? undefined : deleteNode,
            onUpdate: updateNode,
          },
        }));

        console.log('✅ Final nodes with callbacks:', nodesWithCallbacks);

        setNodes(nodesWithCallbacks);
        setEdges(loadedEdges);

        // Calculate next node ID
        const maxId = Math.max(...loadedNodes.map((node: Node) => {
          const match = node.id.match(/-\d+$/);
          return match ? parseInt(match[0].substring(1)) : 0;
        }));
        setNodeId(maxId > 0 ? maxId + 1 : 2);
      } else {
        console.log('❌ No flow data found in automation');
        // Initialize with just a trigger node
        const triggerNode: Node = {
          id: 'trigger-1',
          type: 'triggerNode',
          position: { x: 100, y: 100 },
          data: {
            triggerType: 'new_conversation',
            label: 'Trigger',
            config: {},
            onDelete: undefined,
            onUpdate: updateNode,
          },
        };
        setNodes([triggerNode]);
      }

      setIsLoading(false);
    }
  }, [automation]);

  const triggerAutomation = async () => {
    if (!id) return;

    try {
      // You might want to ask for a contact to test with
      const contactId = prompt('Enter contact ID to test with (or leave empty for test contact):');

      const result = await api.post(`/automations/${id}/trigger`, {
        contactId: contactId || undefined,
        triggerData: { manual_trigger: true }
      });

      if (result.data.success) {
        toast({
          title: "Success",
          description: "Automation triggered successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error triggering automation:', error);
      toast({
        title: "Error",
        description: "Failed to trigger automation",
        variant: "destructive",
      });
    }
  };

  // Delete node function
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId.startsWith('trigger-')) return;

      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    },
    [setNodes, setEdges],
  );

  // Update node function
  const updateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        }),
      );
    },
    [setNodes],
  );

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...defaultEdgeOptions,
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
    if (!connectionState.isValid && connectionState.fromNode) {
      const targetIsPane = (event.target as Element).classList.contains("react-flow__pane");

      if (targetIsPane) {
        const clientX = "clientX" in event ? event.clientX : event.touches[0].clientX;
        const clientY = "clientY" in event ? event.clientY : event.touches[0].clientY;

        setConnectionPopup({
          show: true,
          position: { x: clientX, y: clientY },
          sourceNodeId: connectionState.fromNode.id,
          sourceHandleId: connectionState.fromHandle?.id || null,
        });
      }
    }
  }, []);

  // Node creation function
  const createNode = useCallback((type: string, position: { x: number; y: number }, label: string) => {
    const newNodeId = `${type}-${nodeId}`;

    const baseData = {
      label,
      onDelete: deleteNode,
      onUpdate: updateNode,
    };

    const nodeDataMap: Record<string, any> = {
      triggerNode: { triggerType: "new_conversation", config: {} },
      textMessageNode: { message: "" },
      quickRepliesNode: { quickReplyId: null, quickReply: null },
      listMessageNode: { header: "", body: "", footer: "", buttonText: "Options", sections: [] },
      conditionNode: { rules: [] },
      delayNode: { duration: 0, unit: "minutes" },
      tagNode: { action: "add", tagNames: [] },
      mediaMessageNode: { media: { type: "image" }, caption: "" },
    };

    const newNode: Node = {
      id: newNodeId,
      type,
      position,
      data: { ...baseData, ...nodeDataMap[type] },
    };

    return newNode;
  }, [nodeId, deleteNode, updateNode]);

  // Handle adding nodes from connection popup
  const handleCreateNode = useCallback((type: string) => {
    if (!connectionPopup.sourceNodeId) return;

    const flowPosition = screenToFlowPosition({
      x: connectionPopup.position.x,
      y: connectionPopup.position.y,
    });

    const labels = {
      triggerNode: `Trigger`,
      textMessageNode: `Send Message`,
      quickRepliesNode: `Send Quick Reply`,
      listMessageNode: `List Message`,
      conditionNode: `Condition`,
      delayNode: `Delay`,
      tagNode: `Tag`,
      mediaMessageNode: `Send Media`,
    };

    const newNode = createNode(type, flowPosition, labels[type as keyof typeof labels]);
    setNodes((nds) => [...nds, newNode]);

    // Create edge if there's a source
    if (connectionPopup.sourceNodeId) {
      const newEdge: Edge = {
        id: `${connectionPopup.sourceNodeId}-${newNode.id}`,
        source: connectionPopup.sourceNodeId,
        target: newNode.id,
        sourceHandle: connectionPopup.sourceHandleId,
        ...defaultEdgeOptions,
      };
      setEdges((eds) => [...eds, newEdge]);
    }

    setNodeId((id) => id + 1);
    setConnectionPopup({ show: false, position: { x: 0, y: 0 }, sourceNodeId: null, sourceHandleId: null });
  }, [connectionPopup, screenToFlowPosition, nodeId, createNode, setNodes, setEdges]);

  // Handle adding nodes from sidebar
  const addNode = useCallback((type: string) => {
    if (!reactFlowInstance) return;

    // Get the center of the viewport
    const viewportCenter = reactFlowInstance.getViewport();

    // Add some randomness to position
    const x = viewportCenter.x + Math.random() * 200 - 100;
    const y = viewportCenter.y + Math.random() * 200 - 100;

    const labels = {
      triggerNode: `Trigger ${nodeId}`,
      textMessageNode: `Send Message ${nodeId}`,
      quickRepliesNode: `Quick Replies ${nodeId}`,
      listMessageNode: `List Message ${nodeId}`,
      conditionNode: `Condition ${nodeId}`,
      delayNode: `Delay ${nodeId}`,
      tagNode: `Tag ${nodeId}`,
    };

    const newNode = createNode(type, { x, y }, labels[type as keyof typeof labels] || `Node ${nodeId}`);
    setNodes((nds) => [...nds, newNode]);
    setNodeId((id) => id + 1);

    // Optional: Fit view after adding node
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
  }, [reactFlowInstance, nodeId, createNode, setNodes]);

  // Close connection popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setConnectionPopup({ show: false, position: { x: 0, y: 0 }, sourceNodeId: null, sourceHandleId: null });
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectionPopup({ show: false, position: { x: 0, y: 0 }, sourceNodeId: null, sourceHandleId: null });
      }
    };

    if (connectionPopup.show) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [connectionPopup.show]);

  // Handle node click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== "triggerNode") {
      setSelectedNode(node);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Toggle sidebar sections
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Save workflow
  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your automation",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Clean nodes - remove all functions, React components, and circular references
      const cleanNodes = nodes.map(node => {
        // Create a clean node without the data first
        const cleanNode: any = {
          id: node.id,
          type: node.type,
          position: node.position,
        };

        // Only add data if it exists and is an object
        if (node.data && typeof node.data === 'object') {
          const cleanData: any = {};

          // Safely copy each property
          Object.keys(node.data).forEach(key => {
            const value = node.data[key];

            // Skip functions and undefined
            if (typeof value === 'function' || value === undefined) {
              return;
            }

            // Skip React components or elements
            if (value && typeof value === 'object' &&
              (value.$$typeof === Symbol.for('react.element') ||
                value.$$typeof === Symbol.for('react.fragment'))) {
              return;
            }

            // Handle arrays
            if (Array.isArray(value)) {
              try {
                cleanData[key] = JSON.parse(JSON.stringify(value));
              } catch {
                cleanData[key] = [];
              }
            }
            // Handle objects
            else if (value && typeof value === 'object') {
              try {
                cleanData[key] = JSON.parse(JSON.stringify(value));
              } catch (error) {
                console.warn(`Could not clone property ${key} for node ${node.id}:`, error);
                // Try a shallow clone
                cleanData[key] = { ...value };
              }
            }
            // Handle primitives
            else {
              cleanData[key] = value;
            }
          });

          // Ensure message nodes have their message saved
          if (node.type === 'textMessageNode') {
            // Make sure message is included
            if (node.data.message !== undefined) {
              cleanData.message = node.data.message;
            }

            // Make sure label is included
            if (node.data.label !== undefined) {
              cleanData.label = node.data.label;
            }

            // Include any other important fields
            if (node.data.usedVariables !== undefined) {
              try {
                cleanData.usedVariables = JSON.parse(JSON.stringify(node.data.usedVariables));
              } catch {
                cleanData.usedVariables = [];
              }
            }

            if (node.data.hasVariables !== undefined) {
              cleanData.hasVariables = node.data.hasVariables;
            }
          }

          if (node.type === 'quickRepliesNode') {
            // Make sure quickReplyId is included
            if (node.data.quickReplyId !== undefined) {
              cleanData.quickReplyId = node.data.quickReplyId;
            }

            // Include quickReply object but clean it
            if (node.data.quickReply && typeof node.data.quickReply === 'object') {
              try {
                cleanData.quickReply = {
                  id: node.data.quickReply.id,
                  name: node.data.quickReply.name,
                  message: node.data.quickReply.message,
                  topics: node.data.quickReply.topics,
                  mediaAttachmentIds: node.data.quickReply.mediaAttachmentIds,
                  isActive: node.data.quickReply.isActive,
                };
              } catch {
                cleanData.quickReply = null;
              }
            }

            // Make sure label is included
            if (node.data.label !== undefined) {
              cleanData.label = node.data.label;
            }
          }

          // For trigger nodes, ensure trigger config is saved
          if (node.type === 'triggerNode') {
            if (node.data.triggerType !== undefined) {
              cleanData.triggerType = node.data.triggerType;
            }
            if (node.data.config !== undefined) {
              try {
                cleanData.config = JSON.parse(JSON.stringify(node.data.config));
              } catch {
                cleanData.config = {};
              }
            }
          }

          // Only add data if we have properties
          if (Object.keys(cleanData).length > 0) {
            cleanNode.data = cleanData;
          }
        }

        return cleanNode;
      });

      // Clean edges
      const cleanEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        markerEnd: edge.markerEnd,
        style: edge.style,
      }));

      // Prepare the data
      const workflowData = {
        name: workflowName,
        description: `Automation workflow with ${cleanNodes.filter(n => n.type !== 'triggerNode').length} nodes`,
        status: workflowStatus,
        triggerType: automation?.triggerType || "manual",
        triggerConfig: automation?.triggerConfig || {},
        flowData: {
          nodes: cleanNodes,
          edges: cleanEdges
        },
      };

      // Debug: Log the cleaned data
      console.log("Saving workflow with nodes:", JSON.stringify(cleanNodes, null, 2));
      console.log("Checking trigger nodes:", cleanNodes.filter(n => n.type === 'triggerNode'));

      const result = await updateAutomationMutation.mutateAsync({
        id: id!,
        data: workflowData
      });

      console.log("Save response:", result);

      toast({
        title: "Success",
        description: "Automation updated successfully!",
      });

      refetch();

    } catch (error) {
      console.error('Error updating workflow:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update automation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle workflow status
  const toggleWorkflowStatus = async () => {
    const newStatus = workflowStatus === 'active' ? 'paused' : 'active';

    try {
      await updateStatusMutation.mutateAsync({ id: id!, status: newStatus });
      setWorkflowStatus(newStatus);
      toast({
        title: `Automation ${newStatus === 'active' ? 'activated' : 'paused'}`,
        description: `Automation has been ${newStatus === 'active' ? 'activated' : 'paused'} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update automation status.",
        variant: "destructive",
      });
    }
  };

  // Reset flow
  const resetFlow = useCallback(() => {
    const triggerNode = nodes.find(node => node.type === 'triggerNode');
    if (triggerNode) {
      setNodes([triggerNode]);
    } else {
      // Create a new trigger node if none exists
      const newTriggerNode: Node = {
        id: 'trigger-1',
        type: 'triggerNode',
        position: { x: 100, y: 100 },
        data: {
          triggerType: 'new_conversation',
          label: 'Trigger',
          config: {},
          onDelete: undefined,
          onUpdate: updateNode,
        },
      };
      setNodes([newTriggerNode]);
    }
    setEdges([]);
    setNodeId(2);
    toast({
      title: "Flow reset",
      description: "Automation flow has been reset",
    });
  }, [nodes, setNodes, setEdges, updateNode]);

  const goBack = () => {
    navigate(`/automations/${id}`);
  };

  if (isLoading || isLoadingAutomation) {
    return (
      <MainLayout>
        <div className="h-screen w-full flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading automation...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-screen w-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Bars3Icon className="h-5 w-5" />
              </Button>
            )}
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BoltIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-lg font-semibold border-none focus-visible:ring-0 px-0 w-80 bg-transparent"
              placeholder="Enter automation name..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={workflowStatus === 'active' ? "default" : "outline"}
              size="sm"
              onClick={toggleWorkflowStatus}
              className="gap-2"
              disabled={isSaving}
            >
              {workflowStatus === 'active' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {workflowStatus === 'active' ? 'Pause' : 'Activate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={triggerAutomation}
              disabled={isSaving}
            >
              <PlayIcon className="h-4 w-4" />
              Test Run
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={saveWorkflow}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          {sidebarOpen && (
            <div className="w-72 bg-card border-r border-border flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Automation Blocks</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search blocks" className="pl-9 bg-muted" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-1">
                  {/* Messages Section */}
                  <div>
                    <button
                      onClick={() => toggleSection("messages")}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-secondary"
                    >
                      <span>Messages</span>
                      {expandedSections.messages ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>
                    {expandedSections.messages && (
                      <div className="py-1 pl-4 space-y-1">
                        <button
                          onClick={() => addNode("triggerNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <BoltIcon className="h-4 w-4 text-green-500" />
                          Trigger
                        </button>
                        <button
                          onClick={() => addNode("textMessageNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <PaperAirplaneIcon className="h-4 w-4 text-blue-500" />
                          Send Message
                        </button>
                        <button
                          onClick={() => addNode("mediaMessageNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <PaperClipIcon className="h-4 w-4 text-purple-500" />
                          Send Media
                        </button>
                        <button
                          onClick={() => addNode("quickRepliesNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <ListBulletIcon className="h-4 w-4 text-purple-500" />
                          Quick Replies
                        </button>
                        <button
                          onClick={() => addNode("listMessageNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Squares2X2Icon className="h-4 w-4 text-green-500" />
                          List Message
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Logic Section */}
                  <div>
                    <button
                      onClick={() => toggleSection("logic")}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-secondary"
                    >
                      <span>Logic</span>
                      {expandedSections.logic ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>
                    {expandedSections.logic && (
                      <div className="py-1 pl-4 space-y-1">
                        <button
                          onClick={() => addNode("conditionNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <FunnelIcon className="h-4 w-4 text-purple-500" />
                          Condition
                        </button>
                        <button
                          onClick={() => addNode("delayNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Cog6ToothIcon className="h-4 w-4 text-amber-500" />
                          Delay
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Section */}
                  <div>
                    <button
                      onClick={() => toggleSection("actions")}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-secondary"
                    >
                      <span>Actions</span>
                      {expandedSections.actions ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>
                    {expandedSections.actions && (
                      <div className="py-1 pl-4 space-y-1">
                        <button
                          onClick={() => addNode("tagNode")}
                          className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <ListBulletIcon className="h-4 w-4 text-indigo-500" />
                          Tag Contact
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reset Button */}
                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={resetFlow}
                      disabled={isSaving}
                      className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md transition-colors text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Reset Flow
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Flow Area */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              nodeTypes={{
                ...nodeTypes,
                triggerNode: (props) => {
                  const TriggerNodeComponent = nodeTypes.triggerNode;
                  return (
                    <TriggerNodeComponent
                      {...props}
                      data={{
                        ...props.data,
                        onSelect: (nodeId: string) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (node) {
                            setSelectedNode(node);
                          }
                        },
                      }}
                    />
                  );
                },
                textMessageNode: (props) => {
                  const MessageNodeComponent = nodeTypes.textMessageNode;
                  return (
                    <MessageNodeComponent
                      {...props}
                      data={{
                        ...props.data,
                        onSelect: (nodeId: string) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (node) {
                            setSelectedNode(node);
                          }
                        },
                      }}
                    />
                  );
                },
                mediaMessageNode: (props) => {
                  const MediaNodeComponent = nodeTypes.mediaMessageNode;
                  return (
                    <MediaNodeComponent
                      {...props}
                      data={{
                        ...props.data,
                        onSelect: (nodeId: string) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (node) {
                            setSelectedNode(node);
                          }
                        },
                      }}
                    />
                  );
                },
                quickRepliesNode: (props) => { // Add this
                  const QuickRepliesNodeComponent = nodeTypes.quickRepliesNode;
                  return (
                    <QuickRepliesNodeComponent
                      {...props}
                      data={{
                        ...props.data,
                        onSelect: (nodeId: string) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (node) {
                            setSelectedNode(node);
                          }
                        },
                      }}
                    />
                  );
                },
                tagNode: (props) => {
                  const TagNodeComponent = nodeTypes.tagNode;
                  return (
                    <TagNodeComponent
                      {...props}
                      data={{
                        ...props.data,
                        onSelect: (nodeId: string) => {
                          const node = nodes.find(n => n.id === nodeId);
                          if (node) {
                            setSelectedNode(node);
                          }
                        },
                      }}
                    />
                  );
                },
              }}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodeClick={onNodeClick}
              onInit={setReactFlowInstance}
              proOptions={{ hideAttribution: true }}
              fitView
              className="bg-muted/20"
            >
              <Background className="bg-muted/20" color="#d1d5db" gap={16} />
              <Controls className="bg-card border-border" />
            </ReactFlow>

            {/* Connection Popup */}
            {connectionPopup.show && (
              <div
                ref={popupRef}
                className="absolute z-50 bg-card rounded-lg shadow-lg border border-border w-80 overflow-hidden"
                style={{
                  left: `${connectionPopup.position.x}px`,
                  top: `${connectionPopup.position.y}px`,
                }}
              >
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-sm text-foreground mb-3">Add Block</h3>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search blocks..."
                      className="pl-9 bg-muted h-9"
                    />
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-1 py-2">
                    {/* Messages */}
                    <div className="py-1">
                      <button
                        onClick={() => handleCreateNode("triggerNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <BoltIcon className="h-4 w-4 text-green-500" />
                        Trigger
                      </button>
                      <button
                        onClick={() => handleCreateNode("textMessageNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <PaperAirplaneIcon className="h-4 w-4 text-blue-500" />
                        Send Message
                      </button>
                      <button
                        onClick={() => handleCreateNode("mediaMessageNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <PaperClipIcon className="h-4 w-4 text-purple-500" />
                        Send Media
                      </button>
                      <button
                        onClick={() => handleCreateNode("quickRepliesNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ListBulletIcon className="h-4 w-4 text-purple-500" />
                        Quick Replies
                      </button>
                      <button
                        onClick={() => handleCreateNode("listMessageNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Squares2X2Icon className="h-4 w-4 text-green-500" />
                        List Message
                      </button>
                    </div>

                    {/* Logic */}
                    <div className="py-1">
                      <button
                        onClick={() => handleCreateNode("conditionNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FunnelIcon className="h-4 w-4 text-purple-500" />
                        Condition
                      </button>
                      <button
                        onClick={() => handleCreateNode("delayNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Cog6ToothIcon className="h-4 w-4 text-amber-500" />
                        Delay
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                      <button
                        onClick={() => handleCreateNode("tagNode")}
                        className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ListBulletIcon className="h-4 w-4 text-indigo-500" />
                        Tag Contact
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel for Node Configuration */}
          {selectedNode && selectedNode.type === 'tagNode' ? (
            <TagPanel
              node={selectedNode}
              onClose={closePanel}
              onUpdate={updateNode}
            />
          ) : selectedNode && selectedNode.type === 'triggerNode' ? (
            <TriggerPanel
              node={selectedNode}
              onClose={closePanel}
              onUpdate={updateNode}
            />
          ) : selectedNode && selectedNode.type === 'textMessageNode' ? (
            <TextMessagePanel
              node={selectedNode}
              onClose={closePanel}
              onUpdate={updateNode}
            />
          ) : selectedNode && selectedNode.type === 'mediaMessageNode' ? ( // Add this
            <MediaMessagePanel
              node={selectedNode}
              onClose={closePanel}
              onUpdate={updateNode}
            />
          ) : selectedNode && selectedNode.type === 'quickRepliesNode' ? ( // Add this condition
            <QuickRepliesPanel
              node={selectedNode}
              onClose={closePanel}
              onUpdate={updateNode}
            />) : selectedNode && selectedNode.type === 'conditionNode' ? (
              <ConditionPanel
                node={selectedNode}
                onClose={closePanel}
                onUpdate={updateNode}
              />
            ) : selectedNode && (
              <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    Configure {selectedNode.type?.replace('Node', '').replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePanel}>
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Node Label
                      </label>
                      <Input
                        value={selectedNode.data?.label || ""}
                        onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                        placeholder="Enter node label..."
                      />
                    </div>

                    {/* Node-specific configuration would go here */}
                    <div className="text-sm text-muted-foreground">
                      Configure this {selectedNode.type?.replace('Node', '')} node...
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </MainLayout>
  );
}

export default function AutomationEditor() {
  return (
    <ReactFlowProvider>
      <AutomationEditorInner />
    </ReactFlowProvider>
  );
}