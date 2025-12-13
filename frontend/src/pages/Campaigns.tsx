import { MainLayout } from "@/components/layout/MainLayout";
import {
  RocketLaunchIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  EllipsisVerticalIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const campaigns = [
  {
    id: 1,
    name: "Q1 Lead Generation",
    status: "active",
    type: "Drip Campaign",
    contacts: 1250,
    converted: 186,
    revenue: 45600,
    startDate: "2024-01-01",
    endDate: "2024-03-31",
    progress: 65,
  },
  {
    id: 2,
    name: "Product Launch - Pro Plan",
    status: "active",
    type: "Announcement",
    contacts: 3400,
    converted: 412,
    revenue: 82400,
    startDate: "2024-01-10",
    endDate: "2024-02-10",
    progress: 85,
  },
  {
    id: 3,
    name: "Customer Re-engagement",
    status: "paused",
    type: "Win-back",
    contacts: 890,
    converted: 67,
    revenue: 12300,
    startDate: "2024-01-05",
    endDate: "2024-02-28",
    progress: 40,
  },
  {
    id: 4,
    name: "Holiday Special Offers",
    status: "completed",
    type: "Promotional",
    contacts: 5200,
    converted: 834,
    revenue: 156000,
    startDate: "2023-12-01",
    endDate: "2023-12-31",
    progress: 100,
  },
  {
    id: 5,
    name: "Webinar Registration",
    status: "draft",
    type: "Event",
    contacts: 0,
    converted: 0,
    revenue: 0,
    startDate: "2024-02-01",
    endDate: "2024-02-15",
    progress: 0,
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-crm-success/10 text-crm-success";
    case "paused":
      return "bg-crm-warning/10 text-crm-warning";
    case "completed":
      return "bg-primary/10 text-primary";
    case "draft":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function Campaigns() {
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
  const totalContacts = campaigns.reduce((sum, c) => sum + c.contacts, 0);
  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track your marketing campaigns
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Create Campaign
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <RocketLaunchIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCampaigns}</p>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <UserGroupIcon className="w-5 h-5 text-crm-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalContacts.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Reach</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <ArrowTrendingUpIcon className="w-5 h-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {((totalConverted / totalContacts) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CurrencyDollarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${(totalRevenue / 1000).toFixed(0)}K
                </p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="card-gradient rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{campaign.type}</p>
                </div>
                <div className="flex items-center gap-1">
                  {campaign.status === "active" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <PauseIcon className="w-4 h-4" />
                    </Button>
                  )}
                  {campaign.status === "paused" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <PlayIcon className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChartBarIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <EllipsisVerticalIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">{campaign.progress}%</span>
                  </div>
                  <Progress value={campaign.progress} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Contacts</p>
                    <p className="font-semibold text-foreground">
                      {campaign.contacts.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Converted</p>
                    <p className="font-semibold text-crm-success">
                      {campaign.converted.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="font-semibold text-foreground">
                      ${campaign.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDaysIcon className="w-4 h-4" />
                  <span>
                    {campaign.startDate} - {campaign.endDate}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
