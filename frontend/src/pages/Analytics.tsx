import React, { useState } from 'react';
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  useAnalyticsOverview, 
  useConversationAnalytics, 
  useContactAnalytics,
  useTeamAnalytics,
  useRealtimeAnalytics 
} from "@/lib/api/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  Users, 
  MessageSquare, 
  Clock, 
  TrendingUp,
  Activity,
  Calendar,
  Download,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  Cell
} from 'recharts';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState<string>('month');
  const [activeTab, setActiveTab] = useState<string>('overview');

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(timeRange);
  const { data: conversationAnalytics, isLoading: conversationLoading } = useConversationAnalytics(timeRange);
  const { data: contactAnalytics, isLoading: contactLoading } = useContactAnalytics(timeRange);
  const { data: teamAnalytics, isLoading: teamLoading } = useTeamAnalytics(timeRange);
  const { data: realtimeAnalytics, isLoading: realtimeLoading } = useRealtimeAnalytics();

  const isLoading = overviewLoading || conversationLoading || contactLoading || teamLoading || realtimeLoading;

  // Helper function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Helper to safely format numbers
  const safeFormatNumber = (value: any, decimals: number = 1, suffix: string = ''): string => {
    if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
      return `0${suffix}`;
    }
    return `${value.toFixed(decimals)}${suffix}`;
  };

  if (isLoading) {
    return (
      <>
        <div className="p-8">
          <div className="animate-pulse space-y-8">
            {/* Header skeleton */}
            <div className="flex justify-between items-center">
              <div className="h-8 w-64 bg-secondary rounded"></div>
              <div className="h-10 w-48 bg-secondary rounded"></div>
            </div>
            
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-secondary rounded-xl"></div>
              ))}
            </div>
            
            {/* Chart skeleton */}
            <div className="h-96 bg-secondary rounded-xl"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your messaging performance and insights
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 90 days</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Real-time Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Hour Messages</span>
                  <span className="font-semibold">
                    {realtimeAnalytics?.realtime?.messages_last_hour || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Conversations</span>
                  <span className="font-semibold">
                    {realtimeAnalytics?.realtime?.active_conversations_last_hour || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Unread</span>
                  <Badge variant="outline">
                    {realtimeAnalytics?.unread?.total_unread || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview Stats */}
          {overview && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Total Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overview.summary?.totalConversations || 0}</div>
                  <p className="text-sm text-muted-foreground">
                    {overview.summary?.activeConversations || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overview.summary?.totalMessages || 0}</div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">
                      ↑ {overview.trends?.messageTrends?.slice(-1)[0]?.incoming || 0} incoming
                    </span>
                    <span className="text-blue-600">
                      ↓ {overview.trends?.messageTrends?.slice(-1)[0]?.outgoing || 0} outgoing
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Avg Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeFormatNumber(overview.summary?.avgResponseTime, 1, 'm')}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Faster than average
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Message Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Message Trends</CardTitle>
                <CardDescription>
                  Incoming vs Outgoing messages over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={overview?.trends?.messageTrends || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => formatDate(value)}
                        formatter={(value) => [value, 'Messages']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="incoming" 
                        stroke="#10B981" 
                        name="Incoming"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="outgoing" 
                        stroke="#3B82F6" 
                        name="Outgoing"
                        strokeWidth={2}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversation Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Conversation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview?.trends?.conversationStatus || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {(overview?.trends?.conversationStatus || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Conversations']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Contacts</CardTitle>
                  <CardDescription>Most engaged contacts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {(overview?.insights?.topContacts || []).map((contact, index) => (
                        <div key={contact.phone || index} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {contact.name?.charAt(0) || contact.phone?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{contact.name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{contact.phone || 'No phone'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{contact.message_count || 0}</p>
                            <p className="text-xs text-muted-foreground">messages</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Media Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Media Usage</CardTitle>
                <CardDescription>Types of media shared</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {overview?.insights?.mediaStats && Object.entries(overview.insights.mediaStats)
                    .filter(([key]) => key !== 'total_media')
                    .map(([type, count], index) => (
                      <div key={type} className="text-center p-4 rounded-lg bg-secondary">
                        <div className="text-2xl font-bold">{count || 0}</div>
                        <div className="text-sm text-muted-foreground capitalize">{type}</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-6">
            {conversationAnalytics && (
              <>
                {/* Conversation Growth */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conversation Growth</CardTitle>
                    <CardDescription>New conversations over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversationAnalytics.growth || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => formatDate(value)}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => formatDate(value)}
                          />
                          <Legend />
                          <Bar dataKey="daily_new" name="New Conversations" fill="#3B82F6" />
                          <Bar dataKey="cumulative_count" name="Total Conversations" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Resolution Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Resolution Stats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 rounded-lg bg-secondary">
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
                            <p className="text-2xl font-bold">
                              {safeFormatNumber(conversationAnalytics.resolution?.avg_resolution_hours, 1, 'h')}
                            </p>
                          </div>
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="flex justify-between items-center p-4 rounded-lg bg-secondary">
                          <div>
                            <p className="text-sm text-muted-foreground">Resolved Conversations</p>
                            <p className="text-2xl font-bold">
                              {conversationAnalytics.resolution?.resolved_count || 0}
                            </p>
                          </div>
                          <MessageSquare className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Duration Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Conversation Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 rounded-lg bg-secondary">
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Duration</p>
                            <p className="text-2xl font-bold">
                              {safeFormatNumber(conversationAnalytics.duration?.avgDurationHours, 1, 'h')}
                            </p>
                          </div>
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="flex justify-between items-center p-4 rounded-lg bg-secondary">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Analyzed</p>
                            <p className="text-2xl font-bold">
                              {conversationAnalytics.duration?.totalConversations || 0}
                            </p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6">
            {contactAnalytics && (
              <>
                {/* Contact Growth */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Growth</CardTitle>
                    <CardDescription>New contacts over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={contactAnalytics.growth || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => formatDate(value)}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => formatDate(value)}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="cumulative_count" 
                            stroke="#3B82F6" 
                            name="Total Contacts"
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="daily_new" 
                            stroke="#10B981" 
                            name="New Today"
                            strokeWidth={2}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Engaged Contacts */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Most Engaged Contacts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {(contactAnalytics.engagement || []).map((contact, index) => (
                            <div key={contact.id || index} className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="font-medium">
                                    {contact.name?.charAt(0) || contact.phone?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium">{contact.name || 'Unknown'}</p>
                                  <p className="text-sm text-muted-foreground">{contact.phone || 'No phone'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{contact.message_count || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {contact.active_days || 0} active days
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Demographics */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Demographics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {(contactAnalytics.demographics || []).map((demo, index) => (
                            <div key={`${demo.country}-${demo.city}-${index}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary">
                              <div>
                                <p className="font-medium">
                                  {demo.city !== 'Unknown' ? `${demo.city}, ${demo.country}` : demo.country}
                                </p>
                              </div>
                              <Badge variant="secondary">{demo.count || 0}</Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            {teamAnalytics && (
              <>
                {/* Team Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Team Performance</CardTitle>
                    <CardDescription>Messages sent and response times</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamAnalytics.userPerformance || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => formatDate(value)}
                          />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip 
                            labelFormatter={(value) => formatDate(value)}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="sent_messages" name="Sent Messages" fill="#3B82F6" />
                          <Bar yAxisId="left" dataKey="received_messages" name="Received Messages" fill="#10B981" />
                          <Line 
                            yAxisId="right" 
                            type="monotone" 
                            dataKey="avg_response_time_minutes" 
                            stroke="#FF8042" 
                            name="Avg Response (min)"
                            strokeWidth={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Assignment Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Assignment Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(teamAnalytics.assignmentStats || []).map((assignment, index) => (
                        <div key={assignment.assigned_to || `unassigned-${index}`} className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-medium">
                                {assignment.assigned_to?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">
                                {assignment.assigned_to || 'Unassigned'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {assignment.conversation_count || 0} conversations
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{assignment.resolved_count || 0} resolved</Badge>
                              <Badge variant="secondary" className={(assignment.avg_unread || 0) > 0 ? 'bg-red-500' : ''}>
                                {safeFormatNumber(assignment.avg_unread, 1)} avg unread
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Analytics;