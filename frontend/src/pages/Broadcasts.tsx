import { MainLayout } from "@/components/layout/MainLayout";
import {
  MegaphoneIcon,
  PlusIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const broadcasts = [
  {
    id: 1,
    name: "Summer Sale Announcement",
    status: "sent",
    recipients: 2450,
    delivered: 2398,
    read: 1856,
    sentAt: "2024-01-15 10:30 AM",
    template: "promotional",
  },
  {
    id: 2,
    name: "New Product Launch",
    status: "scheduled",
    recipients: 3200,
    delivered: 0,
    read: 0,
    scheduledFor: "2024-01-20 09:00 AM",
    template: "announcement",
  },
  {
    id: 3,
    name: "Weekly Newsletter",
    status: "draft",
    recipients: 0,
    delivered: 0,
    read: 0,
    template: "newsletter",
  },
  {
    id: 4,
    name: "Holiday Greetings",
    status: "sent",
    recipients: 5680,
    delivered: 5502,
    read: 4231,
    sentAt: "2024-01-10 08:00 AM",
    template: "greeting",
  },
  {
    id: 5,
    name: "Feature Update",
    status: "sending",
    recipients: 1890,
    delivered: 892,
    read: 456,
    template: "update",
  },
];

const templates = [
  { id: 1, name: "Promotional Offer", category: "Marketing", uses: 45 },
  { id: 2, name: "Order Confirmation", category: "Transactional", uses: 234 },
  { id: 3, name: "Welcome Message", category: "Onboarding", uses: 189 },
  { id: 4, name: "Feedback Request", category: "Engagement", uses: 67 },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "sent":
      return "bg-crm-success/10 text-crm-success";
    case "scheduled":
      return "bg-crm-warning/10 text-crm-warning";
    case "draft":
      return "bg-muted text-muted-foreground";
    case "sending":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "sent":
      return <CheckCircleIcon className="w-4 h-4" />;
    case "scheduled":
      return <ClockIcon className="w-4 h-4" />;
    case "sending":
      return <PaperAirplaneIcon className="w-4 h-4" />;
    default:
      return null;
  }
};

export default function Broadcasts() {
  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Broadcasts</h1>
            <p className="text-muted-foreground mt-1">
              Send bulk messages to your contacts
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="w-4 h-4" />
            New Broadcast
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MegaphoneIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">24</p>
                <p className="text-sm text-muted-foreground">Total Broadcasts</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <CheckCircleIcon className="w-5 h-5 text-crm-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">18</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <ClockIcon className="w-5 h-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DocumentDuplicateIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">Drafts</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Broadcasts List */}
          <div className="lg:col-span-2 card-gradient rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Recent Broadcasts</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9 w-48" />
                </div>
                <Button variant="outline" size="icon">
                  <FunnelIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {broadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">
                          {broadcast.name}
                        </h3>
                        <Badge className={getStatusColor(broadcast.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(broadcast.status)}
                            {broadcast.status}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {broadcast.status === "scheduled"
                          ? `Scheduled for ${broadcast.scheduledFor}`
                          : broadcast.status === "sent"
                          ? `Sent on ${broadcast.sentAt}`
                          : broadcast.status === "sending"
                          ? "Currently sending..."
                          : "Not scheduled"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </Button>
                  </div>

                  {broadcast.status !== "draft" && (
                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="font-medium text-foreground">
                          {broadcast.recipients.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Delivered</p>
                        <p className="font-medium text-foreground">
                          {broadcast.delivered.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Read</p>
                        <p className="font-medium text-foreground">
                          {broadcast.read.toLocaleString()}
                        </p>
                      </div>
                      {broadcast.delivered > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Read Rate</p>
                          <p className="font-medium text-crm-success">
                            {((broadcast.read / broadcast.delivered) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="card-gradient rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Message Templates</h2>
              <Button variant="outline" size="sm">
                <PlusIcon className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm">
                        {template.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {template.category}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {template.uses} uses
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
