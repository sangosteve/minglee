import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ConversationList } from "@/components/dashboard/ConversationList";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { TeamPerformance } from "@/components/dashboard/TeamPerformance";
import { QuickActions } from "@/components/dashboard/QuickActions";
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const Index = () => {
  return (
    <MainLayout title="Dashboard" subtitle="Welcome back, John">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="Total Conversations"
          value="1,284"
          change={12.5}
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-primary" />}
          iconBg="bg-primary/10"
        />
        <MetricCard
          title="Active Contacts"
          value="856"
          change={8.2}
          icon={<UsersIcon className="w-6 h-6 text-success" />}
          iconBg="bg-success/10"
        />
        <MetricCard
          title="Avg. Response Time"
          value="3.2m"
          change={-15.3}
          icon={<ClockIcon className="w-6 h-6 text-warning" />}
          iconBg="bg-warning/10"
        />
        <MetricCard
          title="Resolution Rate"
          value="94.2%"
          change={5.1}
          icon={<CheckCircleIcon className="w-6 h-6 text-purple-500" />}
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <ActivityChart />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationList />
        <TeamPerformance />
      </div>
    </MainLayout>
  );
};

export default Index;
