import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const weeklyData = [
  { name: "Mon", messages: 240, resolved: 180, pending: 60 },
  { name: "Tue", messages: 320, resolved: 260, pending: 60 },
  { name: "Wed", messages: 280, resolved: 220, pending: 60 },
  { name: "Thu", messages: 420, resolved: 350, pending: 70 },
  { name: "Fri", messages: 380, resolved: 310, pending: 70 },
  { name: "Sat", messages: 180, resolved: 150, pending: 30 },
  { name: "Sun", messages: 120, resolved: 100, pending: 20 },
];

const channelData = [
  { name: "WhatsApp", value: 65, color: "hsl(142, 76%, 36%)" },
  { name: "Instagram", value: 20, color: "hsl(328, 85%, 61%)" },
  { name: "Web Chat", value: 10, color: "hsl(239, 84%, 67%)" },
  { name: "Email", value: 5, color: "hsl(38, 92%, 50%)" },
];

const responseTimeData = [
  { hour: "8AM", time: 2.5 },
  { hour: "9AM", time: 3.1 },
  { hour: "10AM", time: 4.2 },
  { hour: "11AM", time: 3.8 },
  { hour: "12PM", time: 5.1 },
  { hour: "1PM", time: 4.5 },
  { hour: "2PM", time: 3.2 },
  { hour: "3PM", time: 2.8 },
  { hour: "4PM", time: 3.5 },
  { hour: "5PM", time: 4.0 },
];

const agentPerformance = [
  { name: "Alice", resolved: 145, satisfaction: 98 },
  { name: "Bob", resolved: 128, satisfaction: 95 },
  { name: "Carol", resolved: 112, satisfaction: 92 },
  { name: "David", resolved: 98, satisfaction: 97 },
  { name: "Eve", resolved: 85, satisfaction: 94 },
];

const Analytics = () => {
  return (
    <>
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="Total Messages"
          value="12,847"
          change={18.2}
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-primary" />}
          iconBg="bg-primary/10"
        />
        <MetricCard
          title="New Contacts"
          value="234"
          change={12.5}
          icon={<UsersIcon className="w-6 h-6 text-success" />}
          iconBg="bg-success/10"
        />
        <MetricCard
          title="Avg Response Time"
          value="3.4m"
          change={-22.1}
          icon={<ClockIcon className="w-6 h-6 text-warning" />}
          iconBg="bg-warning/10"
        />
        <MetricCard
          title="Resolution Rate"
          value="96.8%"
          change={4.3}
          icon={<CheckCircleIcon className="w-6 h-6 text-purple-500" />}
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Overview */}
        <div className="bg-card rounded-xl shadow-card border border-border p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-foreground">Weekly Overview</h3>
            <p className="text-sm text-muted-foreground">Messages and resolution stats</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorMessages2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                  }}
                />
                <Area type="monotone" dataKey="messages" stroke="hsl(239, 84%, 67%)" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages2)" />
                <Area type="monotone" dataKey="resolved" stroke="hsl(142, 76%, 36%)" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Resolved</span>
            </div>
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="bg-card rounded-xl shadow-card border border-border p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-foreground">Channel Distribution</h3>
            <p className="text-sm text-muted-foreground">Messages by platform</p>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Share"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            {channelData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time */}
        <div className="bg-card rounded-xl shadow-card border border-border p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-foreground">Response Time by Hour</h3>
            <p className="text-sm text-muted-foreground">Average response time in minutes</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}m`, "Avg. Time"]}
                />
                <Bar dataKey="time" fill="hsl(239, 84%, 67%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="bg-card rounded-xl shadow-card border border-border p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-foreground">Agent Performance</h3>
            <p className="text-sm text-muted-foreground">Top performers this week</p>
          </div>
          <div className="space-y-4">
            {agentPerformance.map((agent, index) => (
              <div key={agent.name} className="flex items-center gap-4 animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">{agent.name[0]}</span>
                  </div>
                  <span className="font-medium text-foreground">{agent.name}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">{agent.resolved}</p>
                    <p className="text-xs text-muted-foreground">Resolved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-success">{agent.satisfaction}%</p>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Analytics;
