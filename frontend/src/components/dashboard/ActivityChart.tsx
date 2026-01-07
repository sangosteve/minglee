// frontend/src/components/dashboard/ActivityChart.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp } from "lucide-react";
import { useAnalyticsOverview } from "@/lib/api/analytics";

interface ActivityChartProps {
  data?: Array<{
    date: string;
    count: number;
    incoming: number;
    outgoing: number;
  }>;
}

export const ActivityChart = ({ data }: ActivityChartProps) => {
  const [selectedRange, setSelectedRange] = useState<'week' | 'month'>('week');
  const { data: weeklyData } = useAnalyticsOverview('week');
  const { data: monthlyData } = useAnalyticsOverview('month');
  
  // Use the appropriate data based on selected range
  const chartData = selectedRange === 'week' 
    ? weeklyData?.trends?.messageTrends || data
    : monthlyData?.trends?.messageTrends;

  // Calculate totals
  const totalIncoming = chartData?.reduce((sum, day) => sum + (day.incoming || 0), 0) || 0;
  const totalOutgoing = chartData?.reduce((sum, day) => sum + (day.outgoing || 0), 0) || 0;
  const totalMessages = totalIncoming + totalOutgoing;
  
  // Calculate week-over-week change (placeholder calculation)
  const calculateChange = () => {
    if (!chartData || chartData.length < 2) return 12.5; // Default
    const lastWeekTotal = totalMessages;
    const prevWeekTotal = totalMessages * 0.85; // Simulated previous week
    return ((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">
              {selectedRange === 'week' ? 'Weekly' : 'Monthly'} Activity
            </CardTitle>
            <CardDescription>Messages received vs sent</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+{calculateChange().toFixed(1)}% this {selectedRange}</span>
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setSelectedRange('week')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  selectedRange === 'week' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background hover:bg-secondary'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setSelectedRange('month')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  selectedRange === 'month' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background hover:bg-secondary'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return selectedRange === 'week' 
                    ? date.toLocaleDateString('en-US', { weekday: 'short' })
                    : `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
                formatter={(value) => [value, 'messages']}
                contentStyle={{ 
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
              />
              <Bar 
                dataKey="incoming" 
                name="Incoming" 
                fill="#10b981" 
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar 
                dataKey="outgoing" 
                name="Outgoing" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalIncoming}</div>
            <div className="text-sm text-gray-600">Incoming</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalOutgoing}</div>
            <div className="text-sm text-gray-600">Outgoing</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalMessages}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};