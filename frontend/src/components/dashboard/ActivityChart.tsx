import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Mon", messages: 240, conversations: 45 },
  { name: "Tue", messages: 320, conversations: 62 },
  { name: "Wed", messages: 280, conversations: 51 },
  { name: "Thu", messages: 420, conversations: 78 },
  { name: "Fri", messages: 380, conversations: 71 },
  { name: "Sat", messages: 180, conversations: 32 },
  { name: "Sun", messages: 120, conversations: 24 },
];

export function ActivityChart() {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-foreground">Weekly Activity</h3>
        <p className="text-sm text-muted-foreground">Messages and conversations overview</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(280, 84%, 67%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(280, 84%, 67%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(220, 13%, 91%)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="hsl(239, 84%, 67%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMessages)"
            />
            <Area
              type="monotone"
              dataKey="conversations"
              stroke="hsl(280, 84%, 67%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorConversations)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Messages</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-sm text-muted-foreground">Conversations</span>
        </div>
      </div>
    </div>
  );
}
