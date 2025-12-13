import { MainLayout } from "@/components/layout/MainLayout";
import {
  SparklesIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  BoltIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  TagIcon,
  UserPlusIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const automations = [
  {
    id: 1,
    name: "Welcome New Subscribers",
    trigger: "New Contact Added",
    triggerIcon: UserPlusIcon,
    actions: ["Send Welcome Email", "Add Tag: New Lead", "Wait 2 days", "Send Follow-up"],
    status: "active",
    runs: 1234,
    lastRun: "2 mins ago",
  },
  {
    id: 2,
    name: "Abandoned Cart Recovery",
    trigger: "Cart Abandoned",
    triggerIcon: ArrowPathIcon,
    actions: ["Wait 1 hour", "Send Reminder", "Wait 24 hours", "Send Discount Offer"],
    status: "active",
    runs: 567,
    lastRun: "15 mins ago",
  },
  {
    id: 3,
    name: "Customer Feedback Request",
    trigger: "Order Delivered",
    triggerIcon: ChatBubbleLeftRightIcon,
    actions: ["Wait 3 days", "Send Survey", "If No Response: Send Reminder"],
    status: "active",
    runs: 892,
    lastRun: "1 hour ago",
  },
  {
    id: 4,
    name: "Lead Nurturing Sequence",
    trigger: "Lead Score > 50",
    triggerIcon: BoltIcon,
    actions: ["Send Product Info", "Wait 2 days", "Send Case Study", "Notify Sales Rep"],
    status: "paused",
    runs: 234,
    lastRun: "2 days ago",
  },
  {
    id: 5,
    name: "Birthday Greetings",
    trigger: "Contact Birthday",
    triggerIcon: ClockIcon,
    actions: ["Send Birthday Message", "Apply Discount Code"],
    status: "active",
    runs: 156,
    lastRun: "5 hours ago",
  },
  {
    id: 6,
    name: "Re-engagement Campaign",
    trigger: "Inactive for 30 days",
    triggerIcon: EnvelopeIcon,
    actions: ["Send Win-back Email", "Wait 7 days", "Add Tag: At Risk"],
    status: "draft",
    runs: 0,
    lastRun: "Never",
  },
];

const templates = [
  { id: 1, name: "Welcome Series", description: "Onboard new contacts with a multi-step welcome sequence", icon: UserPlusIcon },
  { id: 2, name: "Lead Scoring", description: "Automatically score leads based on engagement", icon: BoltIcon },
  { id: 3, name: "Follow-up Reminder", description: "Send follow-ups after specific triggers", icon: ClockIcon },
  { id: 4, name: "Tag Management", description: "Auto-tag contacts based on behavior", icon: TagIcon },
];

export default function Automations() {
  const activeAutomations = automations.filter((a) => a.status === "active").length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runs, 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Automations</h1>
            <p className="text-muted-foreground mt-1">
              Create workflows to automate your customer engagement
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Create Automation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <SparklesIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{automations.length}</p>
                <p className="text-sm text-muted-foreground">Total Automations</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <PlayIcon className="w-5 h-5 text-crm-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeAutomations}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <BoltIcon className="w-5 h-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalRuns.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Automations List */}
          <div className="lg:col-span-2 space-y-4">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="card-gradient rounded-xl p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <automation.triggerIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{automation.name}</h3>
                        {automation.status === "draft" && (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Trigger: {automation.trigger}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {automation.actions.map((action, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs font-normal">
                            {action}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={automation.status === "active"}
                      disabled={automation.status === "draft"}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    <BoltIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Runs:</span>
                    <span className="font-medium text-foreground">
                      {automation.runs.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last run:</span>
                    <span className="font-medium text-foreground">{automation.lastRun}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Templates */}
          <div className="space-y-4">
            <div className="card-gradient rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Quick Templates</h2>
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <template.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground text-sm">
                          {template.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-gradient rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-2">Need Help?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Learn how to create powerful automations with our guides.
              </p>
              <Button variant="outline" className="w-full">
                View Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
