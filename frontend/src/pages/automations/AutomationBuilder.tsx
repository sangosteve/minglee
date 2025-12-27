// frontend/src/pages/automations/AutomationBuilder.tsx
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  DocumentTextIcon,
  TagIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCreateAutomation } from "@/lib/api/automations";
import { nodeTypes } from "@/components/automations/nodes";

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

// Initial nodes
const initialNodes: Node[] = [
  {
    id: "start-1",
    type: "startNode",
    position: { x: 250, y: 100 },
    data: { 
      label: "Start",
      description: "Where your automation begins",
    },
  },
];

const initialEdges: Edge[] = [];

interface ConnectionPopupState {
  show: boolean;
  position: { x: number; y: number };
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

function AutomationBuilderInner() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeId, setNodeId] = useState(2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    messages: true,
    logic: true,
    actions: true,
  });
  const [workflowName, setWorkflowName] = useState("New Automation");
  const [workflowStatus, setWorkflowStatus] = useState<"draft" | "active" | "paused">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [connectionPopup, setConnectionPopup] = useState<ConnectionPopupState>({
    show: false,
    position: { x: 0, y: 0 },
    sourceNodeId: null,
    sourceHandleId: null,
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Mutation hooks
  const createAutomationMutation = useCreateAutomation();

  // Delete node function
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId.startsWith('start-')) return;
      
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

  // Add common node data
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: node.type === "startNode" ? undefined : deleteNode,
          onUpdate: updateNode,
        },
      })),
    );
  }, [setNodes, deleteNode, updateNode]);

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

  // Node creation functions
  const createNode = useCallback((type: string, position: { x: number; y: number }, label: string) => {
    const newNodeId = `${type}-${nodeId}`;
    
    const baseData = {
      label,
      onDelete: deleteNode,
      onUpdate: updateNode,
    };

    const nodeDataMap: Record<string, any> = {
      messageNode: { message: "", type: "text" },
      quickRepliesNode: { body: "", buttons: [] },
      listMessageNode: { header: "", body: "", footer: "", buttonText: "Options", sections: [] },
      conditionNode: { rules: [], logic: "all" },
      delayNode: { duration: 0, unit: "minutes" },
      tagNode: { action: "add", tagId: "", tagName: "" },
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
      messageNode: `Message ${nodeId}`,
      quickRepliesNode: `Quick Replies ${nodeId}`,
      listMessageNode: `List Message ${nodeId}`,
      conditionNode: `Condition ${nodeId}`,
      delayNode: `Delay ${nodeId}`,
      tagNode: `Tag ${nodeId}`,
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

    const { x, y } = reactFlowInstance.project({ x: 100, y: 100 });
    const labels = {
      messageNode: `Message ${nodeId}`,
      quickRepliesNode: `Quick Replies ${nodeId}`,
      listMessageNode: `List Message ${nodeId}`,
      conditionNode: `Condition ${nodeId}`,
      delayNode: `Delay ${nodeId}`,
      tagNode: `Tag ${nodeId}`,
    };

    const newNode = createNode(type, { x, y }, labels[type as keyof typeof labels]);
    setNodes((nds) => [...nds, newNode]);
    setNodeId((id) => id + 1);
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
    if (node.type !== "startNode") {
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

    const actionNodes = nodes.filter(node => 
      node.type !== 'startNode'
    );

    if (actionNodes.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one node to your automation",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const workflowData = {
        name: workflowName,
        status: workflowStatus,
        flow_data: { nodes, edges },
        description: `Automation workflow with ${actionNodes.length} nodes`,
        trigger_type: "manual", // Default trigger
        trigger_config: {},
      };

      await createAutomationMutation.mutateAsync(workflowData);
      
      toast({
        title: "Success",
        description: "Automation created successfully!",
      });
      
      navigate("/automations");
      
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create automation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle workflow status
  const toggleWorkflowStatus = () => {
    setWorkflowStatus(workflowStatus === 'active' ? 'paused' : 'active');
  };

  // Reset flow
  const resetFlow = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setNodeId(2);
    toast({
      title: "Flow reset",
      description: "Automation flow has been reset to initial state",
    });
  }, [setNodes, setEdges]);

  const goBack = () => {
    navigate("/automations");
  };

  return (
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
          <Button variant="outline" size="sm" className="gap-2" disabled={isSaving}>
            Test automation
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
              'Save Automation'
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
                <Input placeholder="Search blocks..." className="pl-9 bg-muted border-border" />
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
                        onClick={() => addNode("messageNode")}
                        className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                        Send Message
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
                        <FunnelIcon className="h-4 w-4 text-amber-500" />
                        Condition
                      </button>
                      <button
                        onClick={() => addNode("delayNode")}
                        className="w-full flex items-center gap-3 text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <ClockIcon className="h-4 w-4 text-indigo-500" />
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
                        <TagIcon className="h-4 w-4 text-emerald-500" />
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
                    <TrashIcon className="h-4 w-4" />
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
            nodeTypes={nodeTypes}
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
                    className="pl-9 bg-muted h-9 border-border"
                  />
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-1 py-2">
                  {/* Messages */}
                  <div className="py-1">
                    <button
                      onClick={() => handleCreateNode("messageNode")}
                      className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                      Send Message
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
                      <FunnelIcon className="h-4 w-4 text-amber-500" />
                      Condition
                    </button>
                    <button
                      onClick={() => handleCreateNode("delayNode")}
                      className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ClockIcon className="h-4 w-4 text-indigo-500" />
                      Delay
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <button
                      onClick={() => handleCreateNode("tagNode")}
                      className="w-full flex items-center gap-3 text-sm px-8 py-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <TagIcon className="h-4 w-4 text-emerald-500" />
                      Tag Contact
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel for Node Configuration */}
        {selectedNode && (
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
                    className="border-border"
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
  );
}

export default function AutomationBuilder() {
  return (
    <ReactFlowProvider>
      <AutomationBuilderInner />
    </ReactFlowProvider>
  );
}