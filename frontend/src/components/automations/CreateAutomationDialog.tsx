// frontend/src/components/automations/CreateAutomationDialog.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useCreateAutomation } from "@/lib/api/automations";
import { Loader2 } from "lucide-react";

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (automationId: string) => void;
}

export function CreateAutomationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateAutomationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createAutomationMutation = useCreateAutomation();

  const generateStartNode = () => ({
  id: `start_${Date.now()}`,
  type: 'startNode',
  position: { x: 100, y: 100 },
  data: {
    label: 'Start',
    triggerType: 'manual',
    triggerConfig: {},
  },
});

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!name.trim()) {
    toast({
      title: "Error",
      description: "Please enter a name for your automation",
      variant: "destructive",
    });
    return;
  }

  try {
    const result = await createAutomationMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      status: "draft",
      trigger_type: "manual",
      trigger_config: {},
      // Add the start node here
      flow_data: { 
        nodes: [generateStartNode()], 
        edges: [] 
      },
    });

    if (result.success) {
      toast({
        title: "Success",
        description: "Automation created successfully",
      });
      
      // Reset form
      setName("");
      setDescription("");
      
      // Close dialog
      onOpenChange(false);
      
      // Call success callback with automation ID
      if (onSuccess && result.data?.id) {
        onSuccess(result.data.id);
      }
    }
  } catch (error) {
    console.error("Error creating automation:", error);
    toast({
      title: "Error",
      description: "Failed to create automation",
      variant: "destructive",
    });
  }
};
  const handleCancel = () => {
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Create Automation
            </DialogTitle>
            <DialogDescription>
              Set up a new automation workflow. You can customize triggers and actions later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-3">
              <Label htmlFor="name" className="text-sm font-medium">
                Name
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Welcome new customers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
                disabled={createAutomationMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Name your workflow (only visible internally)
              </p>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Briefly describe your workflow for internal reference"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={createAutomationMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Help your team understand what this automation does
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">What happens next?</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                  You'll be taken to the automation builder
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                  Set up triggers and add message blocks
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                  Test and activate when ready
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createAutomationMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={createAutomationMutation.isPending || !name.trim()}
            >
              {createAutomationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Automation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}