// frontend/src/pages/Index.tsx
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { TeamPerformance } from "@/components/dashboard/TeamPerformance";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useAnalyticsOverview, useRealtimeAnalytics } from "@/lib/api/analytics";
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

const Index = () => {
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview('today');
  const { data: realtime, isLoading: realtimeLoading } = useRealtimeAnalytics();

  const isLoading = overviewLoading || realtimeLoading;

  if (isLoading) {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 h-96 bg-secondary rounded-xl animate-pulse"></div>
          <div className="h-96 bg-secondary rounded-xl animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-secondary rounded-xl animate-pulse"></div>
          <div className="h-96 bg-secondary rounded-xl animate-pulse"></div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="Total Conversations"
          value={overview?.summary.totalConversations.toString() || "0"}
          change={12.5}
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-primary" />}
          iconBg="bg-primary/10"
          trend="up"
        />
        <MetricCard
          title="Active Conversations"
          value={overview?.summary.activeConversations.toString() || "0"}
          change={8.2}
          icon={<UsersIcon className="w-6 h-6 text-success" />}
          iconBg="bg-success/10"
          trend="up"
        />
        <MetricCard
          title="Avg. Response Time"
          value={`${overview?.summary.avgResponseTime.toFixed(1) || "0"}m`}
          change={-15.3}
          icon={<ClockIcon className="w-6 h-6 text-warning" />}
          iconBg="bg-warning/10"
          trend="down"
        />
        <MetricCard
          title="Messages Today"
          value={realtime?.realtime.messages_last_hour.toString() || "0"}
          change={5.1}
          icon={<CheckCircleIcon className="w-6 h-6 text-purple-500" />}
          iconBg="bg-purple-500/10"
          trend="up"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <ActivityChart data={overview?.trends.messageTrends} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationList />
        <TeamPerformance data={overview?.insights.topContacts} />
      </div>
    </>
  );
};

export default Index;