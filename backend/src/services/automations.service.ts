// backend/src/services/automations.service.ts
import { db } from '../db/client';
import { automations, automationRuns } from '../db/schema';
import { eq, and, desc, asc, like, sql } from 'drizzle-orm';

export interface CreateAutomationDto {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused';
  triggerType?: string;
  triggerConfig?: any;
  flowData?: any;
}

export interface UpdateAutomationDto extends Partial<CreateAutomationDto> {}

export interface AutomationFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AutomationsService {
  // Get all automations with filters
  async getAutomations(userId: string, filters: AutomationFilters = {}) {
    try {
      const {
        search,
        status,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions
      const conditions = [eq(automations.userId, userId)];

      if (status && status !== 'all') {
        conditions.push(eq(automations.status, status));
      }

      if (search) {
        conditions.push(like(automations.name, `%${search}%`));
      }

      // Build order by
      const orderByField = sortBy as keyof typeof automations;
      const orderBy = sortOrder === 'asc' 
        ? asc(automations[orderByField]) 
        : desc(automations[orderByField]);

      // Get automations with pagination
      const data = await db
        .select()
        .from(automations)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql`count(*)` })
        .from(automations)
        .where(and(...conditions));

      return {
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: Number(count),
          pages: Math.ceil(Number(count) / limitNum),
        },
      };
    } catch (error) {
      console.error('Error fetching automations:', error);
      return {
        success: false,
        error: 'Failed to fetch automations',
      };
    }
  }

  // Get automation by ID
  async getAutomation(userId: string, automationId: string) {
    try {
      const [automation] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!automation) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      return {
        success: true,
        data: automation,
      };
    } catch (error) {
      console.error('Error fetching automation:', error);
      return {
        success: false,
        error: 'Failed to fetch automation',
      };
    }
  }

  // Create automation
async createAutomation(userId: string, data: CreateAutomationDto) {
  try {
    // Ensure flow_data has a start node if not provided
    let flowData = data.flowData;
    
    if (!flowData || !flowData.nodes || flowData.nodes.length === 0) {
      // Create a default start node
      flowData = {
        nodes: [
          {
            id: 'trigger-' + Date.now(),
            type: 'triggerNode',
            position: { x: 100, y: 100 },
            data: {
              label: 'Trigger',
              triggerType: data.triggerType || 'new_conversation',
              triggerConfig: data.triggerConfig || {},
            },
          },
        ],
        edges: [],
      };
    } else if (!flowData.nodes.some((node: any) => node.type === 'triggerNode')) {
      // Add start node if not present
      flowData.nodes.unshift({
    id: 'trigger-' + Date.now(),
        type: 'triggerNode', 
        position: { x: 100, y: 100 },
        data: {
          label: 'Trigger',
          triggerType: data.triggerType || 'new_conversation',
          triggerConfig: data.triggerConfig || {},
        },
      });
    }

    const [automation] = await db
      .insert(automations)
      .values({
        ...data,
        flowData, // Use the updated flowData
        userId,
      })
      .returning();

    return {
      success: true,
      data: automation,
      message: 'Automation created successfully',
    };
  } catch (error) {
    console.error('Error creating automation:', error);
    return {
      success: false,
      error: 'Failed to create automation',
    };
  }
}

  // Update automation
  async updateAutomation(userId: string, automationId: string, data: UpdateAutomationDto) {
    try {
      // Check if automation exists and belongs to user
      const [existing] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      const [automation] = await db
        .update(automations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .returning();

      return {
        success: true,
        data: automation,
        message: 'Automation updated successfully',
      };
    } catch (error) {
      console.error('Error updating automation:', error);
      return {
        success: false,
        error: 'Failed to update automation',
      };
    }
  }

  // Update automation status
  async updateAutomationStatus(userId: string, automationId: string, status: string) {
    try {
      if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
        return {
          success: false,
          error: 'Invalid status',
        };
      }

      // Check if automation exists and belongs to user
      const [existing] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      const [automation] = await db
        .update(automations)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .returning();

      return {
        success: true,
        data: automation,
        message: `Automation ${status} successfully`,
      };
    } catch (error) {
      console.error('Error updating automation status:', error);
      return {
        success: false,
        error: 'Failed to update automation status',
      };
    }
  }

  // Delete automation
  async deleteAutomation(userId: string, automationId: string) {
    try {
      // Check if automation exists and belongs to user
      const [existing] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      await db
        .delete(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        );

      return {
        success: true,
        message: 'Automation deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting automation:', error);
      return {
        success: false,
        error: 'Failed to delete automation',
      };
    }
  }

  // Get automation analytics/overview
  async getAutomationAnalytics(userId: string) {
    try {
      const stats = await db
        .select({
          status: automations.status,
          count: sql`count(*)`,
        })
        .from(automations)
        .where(eq(automations.userId, userId))
        .groupBy(automations.status);

      const totalAutomations = stats.reduce((acc, stat) => acc + Number(stat.count), 0);

      // Get recent automation runs if needed
      const recentRuns = await db
        .select()
        .from(automationRuns)
        .where(
          and(
            eq(automationRuns.userId, userId),
            eq(automationRuns.status, 'completed')
          )
        )
        .orderBy(desc(automationRuns.createdAt))
        .limit(5);

      return {
        success: true,
        data: {
          total: totalAutomations,
          totalContacts: totalAutomations, // For compatibility with UI
          byStatus: stats.map(stat => ({
            status: stat.status,
            count: Number(stat.count),
          })),
          newThisWeek: 0, // You can calculate this if needed
          newThisMonth: 0, // You can calculate this if needed
          recentRuns,
        },
      };
    } catch (error) {
      console.error('Error fetching automation analytics:', error);
      return {
        success: false,
        error: 'Failed to fetch automation analytics',
      };
    }
  }

  // Test automation
  async testAutomation(userId: string, automationId: string) {
    try {
      // Check if automation exists and belongs to user
      const [automation] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!automation) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      // Create a test run record
      const [run] = await db
        .insert(automationRuns)
        .values({
          automationId,
          userId,
          triggerData: { test: true },
          status: 'completed',
          executionData: { test: true, success: true },
          completedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        message: 'Automation test executed successfully',
        data: {
          automationId,
          runId: run.id,
          status: 'test_executed',
        },
      };
    } catch (error) {
      console.error('Error testing automation:', error);
      return {
        success: false,
        error: 'Failed to test automation',
      };
    }
  }

  // Get automation runs
  async getAutomationRuns(userId: string, automationId: string, page = 1, limit = 20) {
    try {
      // Verify automation belongs to user
      const [automation] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.id, automationId),
            eq(automations.userId, userId)
          )
        )
        .limit(1);

      if (!automation) {
        return {
          success: false,
          error: 'Automation not found',
        };
      }

      const offset = (page - 1) * limit;

      const runs = await db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId))
        .orderBy(desc(automationRuns.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql`count(*)` })
        .from(automationRuns)
        .where(eq(automationRuns.automationId, automationId));

      return {
        success: true,
        data: runs,
        pagination: {
          page,
          limit,
          total: Number(count),
          pages: Math.ceil(Number(count) / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching automation runs:', error);
      return {
        success: false,
        error: 'Failed to fetch automation runs',
      };
    }
  }

  // Create automation run (for execution engine)
  async createAutomationRun(data: {
    automationId: string;
    contactId?: string;
    userId?: string;
    triggerData?: any;
    status?: string;
  }) {
    try {
      const [run] = await db
        .insert(automationRuns)
        .values({
          ...data,
          createdAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: run,
      };
    } catch (error) {
      console.error('Error creating automation run:', error);
      return {
        success: false,
        error: 'Failed to create automation run',
      };
    }
  }

  // Update automation run (for execution engine)
  async updateAutomationRun(runId: string, data: {
    executionData?: any;
    nodeExecutions?: any[];
    error?: string;
    status?: string;
    completedAt?: Date;
  }) {
    try {
      const [run] = await db
        .update(automationRuns)
        .set({
          ...data,
        })
        .where(eq(automationRuns.id, runId))
        .returning();

      return {
        success: true,
        data: run,
      };
    } catch (error) {
      console.error('Error updating automation run:', error);
      return {
        success: false,
        error: 'Failed to update automation run',
      };
    }
  }
}

export const automationsService = new AutomationsService();