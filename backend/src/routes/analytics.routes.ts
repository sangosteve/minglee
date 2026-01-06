// backend/src/routes/analytics.routes.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { contacts, conversations, messages, users, mediaAttachments } from '../db/schema';
import { eq, and, gte, lte, sql, count, desc, asc } from 'drizzle-orm';

const router = Router();

// Helper to get time range
function getTimeRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30); // Default 30 days
  }
  
  return { start, end };
}

// Helper to format date for queries
function formatDateForQuery(date: Date): string {
  return date.toISOString();
}

// Helper function to safely parse numeric values
function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

// GET /api/analytics/overview - Get dashboard overview
router.get('/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    const { range = 'month' } = req.query;
    const { start, end } = getTimeRange(range as string);

    console.log('📊 Analytics overview requested for user:', userId, 'range:', range);

    // 1. Total conversations
    const [totalConversations] = await db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    // 2. Active conversations (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const [activeConversations] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gte(conversations.lastMessageAt, yesterday)
        )
      );

    // 3. Total messages in time range (via conversations)
    const totalMessagesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
        AND m.created_at <= ${formatDateForQuery(end)}
    `);

    const totalMessages = safeParseNumber(totalMessagesResult.rows[0]?.count);

    // 4. Message trends (daily) - simplified for now
    const messageTrendsResult = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', m.created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
        AND m.created_at <= ${formatDateForQuery(end)}
      GROUP BY DATE_TRUNC('day', m.created_at)
      ORDER BY date ASC
    `);

    // 5. Conversation status breakdown
    const conversationStatus = await db
      .select({
        status: conversations.status,
        count: count(),
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .groupBy(conversations.status);

    // 6. SIMPLIFIED Response time metrics - use a simpler approach
    // Instead of complex query, calculate based on average time between incoming and next outgoing
    const responseTimeResult = await db.execute(sql`
      WITH response_times AS (
        SELECT 
          c.id as conversation_id,
          MIN(incoming.created_at) as first_incoming,
          MIN(outgoing.created_at) as first_outgoing_after_incoming
        FROM conversations c
        JOIN messages incoming ON c.id = incoming.conversation_id
        LEFT JOIN messages outgoing ON c.id = outgoing.conversation_id
          AND outgoing.direction = 'outgoing'
          AND outgoing.created_at > incoming.created_at
        WHERE c.user_id = ${userId}
          AND incoming.direction = 'incoming'
          AND incoming.created_at >= ${formatDateForQuery(start)}
        GROUP BY c.id, incoming.id
      )
      SELECT 
        AVG(
          EXTRACT(EPOCH FROM (first_outgoing_after_incoming - first_incoming)) / 60
        ) as avg_response_minutes
      FROM response_times
      WHERE first_outgoing_after_incoming IS NOT NULL
        AND first_outgoing_after_incoming > first_incoming
    `);

    // Parse the response time safely
    let avgResponseTime = 0;
    if (responseTimeResult.rows[0]?.avg_response_minutes !== null && 
        responseTimeResult.rows[0]?.avg_response_minutes !== undefined) {
      avgResponseTime = safeParseNumber(responseTimeResult.rows[0].avg_response_minutes);
    }

    // 7. Top contacts by message count
    const topContactsResult = await db.execute(sql`
      SELECT 
        ct.name,
        ct.phone,
        COUNT(m.id) as message_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
      GROUP BY ct.id, ct.name, ct.phone
      ORDER BY message_count DESC
      LIMIT 10
    `);

    // 8. Media usage stats
    const mediaStatsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_media,
        SUM(CASE WHEN m.message_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN m.message_type = 'video' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN m.message_type = 'audio' THEN 1 ELSE 0 END) as audio,
        SUM(CASE WHEN m.message_type = 'document' THEN 1 ELSE 0 END) as documents
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
        AND m.message_type IN ('image', 'video', 'audio', 'document')
    `);

    // Format the response data
    const responseData = {
      summary: {
        totalConversations: safeParseNumber(totalConversations.count),
        activeConversations: safeParseNumber(activeConversations.count),
        totalMessages: totalMessages,
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)), // Now safe to call toFixed
      },
      trends: {
        messageTrends: (messageTrendsResult.rows || []).map(row => ({
          date: row.date,
          count: safeParseNumber(row.count),
          incoming: safeParseNumber(row.incoming),
          outgoing: safeParseNumber(row.outgoing),
        })),
        conversationStatus: conversationStatus.map(status => ({
          status: status.status,
          count: safeParseNumber(status.count),
        })),
      },
      insights: {
        topContacts: (topContactsResult.rows || []).map(contact => ({
          name: contact.name || 'Unknown',
          phone: contact.phone || 'No phone',
          message_count: safeParseNumber(contact.message_count),
        })),
        mediaStats: mediaStatsResult.rows[0] || {
          total_media: 0,
          images: 0,
          videos: 0,
          audio: 0,
          documents: 0,
        },
      },
      timeframe: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };

    // Convert mediaStats values to numbers
    if (responseData.insights.mediaStats) {
      responseData.insights.mediaStats = {
        total_media: safeParseNumber(responseData.insights.mediaStats.total_media),
        images: safeParseNumber(responseData.insights.mediaStats.images),
        videos: safeParseNumber(responseData.insights.mediaStats.videos),
        audio: safeParseNumber(responseData.insights.mediaStats.audio),
        documents: safeParseNumber(responseData.insights.mediaStats.documents),
      };
    }

    console.log('✅ Analytics overview response:', JSON.stringify(responseData.summary, null, 2));

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error('❌ Error in analytics overview:', error.message || error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics',
      details: error.message 
    });
  }
});

// GET /api/analytics/conversations - Get conversation analytics
router.get('/conversations', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    const { range = 'month' } = req.query;
    const { start, end } = getTimeRange(range as string);

    console.log('📊 Conversation analytics for user:', userId);

    // Conversation growth over time
    const conversationGrowthResult = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as cumulative_count
      FROM conversations
      WHERE user_id = ${userId}
        AND created_at >= ${formatDateForQuery(start)}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);

    // Simplified duration stats
    const durationStatsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_conversations,
        AVG(EXTRACT(EPOCH FROM (last_message_at - created_at)) / 3600) as avg_duration_hours
      FROM conversations
      WHERE user_id = ${userId}
        AND created_at >= ${formatDateForQuery(start)}
        AND last_message_at > created_at
    `);

    // Resolution time (for resolved conversations)
    const resolutionStatsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as resolved_count
      FROM conversations
      WHERE user_id = ${userId}
        AND status = 'resolved'
        AND created_at >= ${formatDateForQuery(start)}
    `);

    const durationData = durationStatsResult.rows[0] || { total_conversations: 0, avg_duration_hours: 0 };
    const resolutionData = resolutionStatsResult.rows[0] || { resolved_count: 0 };

    res.json({
      success: true,
      data: {
        growth: (conversationGrowthResult.rows || []).map(row => ({
          date: row.date,
          cumulative_count: safeParseNumber(row.cumulative_count),
        })),
        duration: {
          avgDurationHours: parseFloat(safeParseNumber(durationData.avg_duration_hours).toFixed(2)),
          totalConversations: safeParseNumber(durationData.total_conversations),
        },
        resolution: {
          resolved_count: safeParseNumber(resolutionData.resolved_count),
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error in conversation analytics:', error.message || error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation analytics',
      details: error.message 
    });
  }
});

// GET /api/analytics/contacts - Get contact analytics
router.get('/contacts', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    const { range = 'month' } = req.query;
    const { start, end } = getTimeRange(range as string);

    console.log('📊 Contact analytics for user:', userId);

    // Contact growth
    const contactGrowthResult = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as cumulative_count
      FROM contacts
      WHERE user_id = ${userId}
        AND created_at >= ${formatDateForQuery(start)}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);

    // Contact engagement (messages per contact)
    const engagementResult = await db.execute(sql`
      SELECT 
        ct.id,
        ct.name,
        ct.phone,
        COUNT(m.id) as message_count
      FROM contacts ct
      JOIN conversations c ON ct.id = c.contact_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE ct.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
      GROUP BY ct.id, ct.name, ct.phone
      ORDER BY message_count DESC
      LIMIT 20
    `);

    // Contact demographics (if available)
    const demographicsResult = await db.execute(sql`
      SELECT 
        COALESCE(country, 'Unknown') as country,
        COALESCE(city, 'Unknown') as city,
        COUNT(*) as count
      FROM contacts
      WHERE user_id = ${userId}
      GROUP BY country, city
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        growth: (contactGrowthResult.rows || []).map(row => ({
          date: row.date,
          cumulative_count: safeParseNumber(row.cumulative_count),
        })),
        engagement: (engagementResult.rows || []).map(contact => ({
          id: contact.id,
          name: contact.name || 'Unknown',
          phone: contact.phone || 'No phone',
          message_count: safeParseNumber(contact.message_count),
        })),
        demographics: (demographicsResult.rows || []).map(demo => ({
          country: demo.country,
          city: demo.city,
          count: safeParseNumber(demo.count),
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ Error in contact analytics:', error.message || error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch contact analytics',
      details: error.message 
    });
  }
});

// GET /api/analytics/team - Get team performance analytics
router.get('/team', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    const { range = 'month' } = req.query;
    const { start, end } = getTimeRange(range as string);

    console.log('📊 Team analytics for user:', userId);

    // User performance (messages per day)
    const userPerformanceResult = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', m.created_at) as date,
        COUNT(*) as total_messages,
        SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END) as sent_messages,
        SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END) as received_messages
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(start)}
      GROUP BY DATE_TRUNC('day', m.created_at)
      ORDER BY date ASC
    `);

    // Conversation assignment stats
    const assignmentResult = await db.execute(sql`
      SELECT 
        u.name as assigned_to,
        COUNT(c.id) as conversation_count,
        AVG(c.unread_count) as avg_unread,
        SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
      FROM conversations c
      LEFT JOIN users u ON c.assigned_to_user_id = u.id
      WHERE c.user_id = ${userId}
        AND c.created_at >= ${formatDateForQuery(start)}
      GROUP BY u.id, u.name
      ORDER BY conversation_count DESC
    `);

    res.json({
      success: true,
      data: {
        userPerformance: (userPerformanceResult.rows || []).map(row => ({
          date: row.date,
          total_messages: safeParseNumber(row.total_messages),
          sent_messages: safeParseNumber(row.sent_messages),
          received_messages: safeParseNumber(row.received_messages),
        })),
        assignmentStats: (assignmentResult.rows || []).map(assignment => ({
          assigned_to: assignment.assigned_to || 'Unassigned',
          conversation_count: safeParseNumber(assignment.conversation_count),
          avg_unread: parseFloat(safeParseNumber(assignment.avg_unread).toFixed(1)),
          resolved_count: safeParseNumber(assignment.resolved_count),
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ Error in team analytics:', error.message || error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch team analytics',
      details: error.message 
    });
  }
});

// GET /api/analytics/realtime - Get real-time analytics
router.get('/realtime', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();

    console.log('📊 Real-time analytics for user:', userId);

    // Current hour stats
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const realtimeResult = await db.execute(sql`
      SELECT 
        COUNT(*) as messages_last_hour,
        SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END) as incoming_last_hour,
        SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing_last_hour,
        COUNT(DISTINCT m.conversation_id) as active_conversations_last_hour
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.created_at >= ${formatDateForQuery(hourAgo)}
    `);

    // Unread conversations
    const unreadResult = await db.execute(sql`
      SELECT 
        SUM(unread_count) as total_unread,
        COUNT(*) as conversations_with_unread
      FROM conversations
      WHERE user_id = ${userId}
        AND unread_count > 0
    `);

    // Currently assigned conversations with users
    const activeUsersResult = await db.execute(sql`
      SELECT 
        u.name,
        COUNT(c.id) as assigned_conversations
      FROM users u
      LEFT JOIN conversations c ON u.id = c.assigned_to_user_id
      WHERE c.user_id = ${userId}
      GROUP BY u.id, u.name
      LIMIT 10
    `);

    const realtimeData = realtimeResult.rows[0] || {
      messages_last_hour: 0,
      incoming_last_hour: 0,
      outgoing_last_hour: 0,
      active_conversations_last_hour: 0,
    };

    const unreadData = unreadResult.rows[0] || {
      total_unread: 0,
      conversations_with_unread: 0,
    };

    res.json({
      success: true,
      data: {
        realtime: {
          messages_last_hour: safeParseNumber(realtimeData.messages_last_hour),
          incoming_last_hour: safeParseNumber(realtimeData.incoming_last_hour),
          outgoing_last_hour: safeParseNumber(realtimeData.outgoing_last_hour),
          active_conversations_last_hour: safeParseNumber(realtimeData.active_conversations_last_hour),
        },
        unread: {
          total_unread: safeParseNumber(unreadData.total_unread),
          conversations_with_unread: safeParseNumber(unreadData.conversations_with_unread),
        },
        activeUsers: (activeUsersResult.rows || []).map(user => ({
          name: user.name,
          assigned_conversations: safeParseNumber(user.assigned_conversations),
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Error in realtime analytics:', error.message || error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch realtime analytics',
      details: error.message 
    });
  }
});

// GET /api/analytics/health - Health check for analytics
router.get('/health', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const db = getDb();
    
    // Test counts
    const [conversationCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId));
    
    const [contactCount] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    const messageCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
    `);
    
    res.json({
      success: true,
      data: {
        user: userId,
        counts: {
          conversations: safeParseNumber(conversationCount.count),
          contacts: safeParseNumber(contactCount.count),
          messages: safeParseNumber(messageCountResult.rows[0]?.count),
        },
        services: {
          database: 'connected',
          analytics: 'operational',
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Analytics health check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Analytics health check failed',
      details: error.message 
    });
  }
});

export default router;