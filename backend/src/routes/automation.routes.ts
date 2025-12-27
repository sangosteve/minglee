// backend/src/routes/automation.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { contacts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { automationsService } from '../services/automations.service';
import { automationExecutionService } from '../services/automation-execution.service';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas




// GET /api/automations - Get all automations with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { 
      search, 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    const userId = req.user!.userId;
    
    const result = await automationsService.getAutomations(userId, {
      search: search as string,
      status: status as string,
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch automations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/automations/:id - Get automation by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await automationsService.getAutomation(userId, automationId);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/automations - Create automation
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    console.log('📝 CREATE AUTOMATION (No Zod)');
    console.log('Request body:', req.body);
    
    // Basic validation
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request body' 
      });
    }
    
    // Required fields
    if (!req.body.name || typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name is required and must be a non-empty string' 
      });
    }
    
    // Build data object with defaults
    const createData = {
      name: req.body.name.trim(),
      description: req.body.description || '',
      status: req.body.status || 'draft',
      triggerType: req.body.triggerType || 'manual',
      triggerConfig: req.body.triggerConfig || {},
      flowData: req.body.flowData || { nodes: [], edges: [] },
    };
    
    console.log('✅ Creating automation with data:', createData);
    
    const result = await automationsService.createAutomation(userId, createData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.status(201).json(result);
    
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/automations/:id - Update automation
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    
    console.log('📝 UPDATE AUTOMATION (No Zod)');
    console.log('User ID:', userId);
    console.log('Automation ID:', automationId);
    console.log('Request body:', req.body);
    
    // Basic validation without Zod
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request body' 
      });
    }
    
    // Extract and validate data
    const updateData: any = {};
    
    // Name validation
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Name must be a non-empty string' 
        });
      }
      updateData.name = req.body.name.trim();
    }
    
    // Description validation
    if (req.body.description !== undefined) {
      if (typeof req.body.description !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Description must be a string' 
        });
      }
      updateData.description = req.body.description;
    }
    
    // Status validation
    if (req.body.status !== undefined) {
      const validStatuses = ['draft', 'active', 'paused'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ 
          success: false, 
          error: `Status must be one of: ${validStatuses.join(', ')}` 
        });
      }
      updateData.status = req.body.status;
    }
    
    // Trigger type validation
    if (req.body.triggerType !== undefined) {
      if (typeof req.body.triggerType !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Trigger type must be a string' 
        });
      }
      updateData.triggerType = req.body.triggerType;
    }
    
    // Trigger config validation
    if (req.body.triggerConfig !== undefined) {
      if (typeof req.body.triggerConfig !== 'object' || req.body.triggerConfig === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'Trigger config must be an object' 
        });
      }
      updateData.triggerConfig = req.body.triggerConfig;
    }
    
    // Flow data validation
    if (req.body.flowData !== undefined) {
      if (typeof req.body.flowData !== 'object' || req.body.flowData === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'Flow data must be an object' 
        });
      }
      
      // Ensure flowData has nodes and edges arrays
      const flowData = req.body.flowData;
      if (!Array.isArray(flowData.nodes)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Flow data must have a nodes array' 
        });
      }
      
      if (!Array.isArray(flowData.edges)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Flow data must have an edges array' 
        });
      }
      
      updateData.flowData = flowData;
    }
    
    console.log('✅ Validated update data:', updateData);
    
    // Call the service
    const result = await automationsService.updateAutomation(userId, automationId, updateData);
    
    console.log('Service result:', result);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('💥 Error updating automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PATCH /api/automations/:id/status - Update automation status
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status is required' 
      });
    }
    
    const result = await automationsService.updateAutomationStatus(userId, automationId, status);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating automation status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update automation status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/automations/:id - Delete automation
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await automationsService.deleteAutomation(userId, automationId);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/automations/stats/overview - Get automation statistics
router.get('/stats/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await automationsService.getAutomationAnalytics(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching automation stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch automation stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/automations/:id/test - Test automation
router.post('/:id/test', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    
    const result = await automationsService.testAutomation(userId, automationId);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error testing automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/automations/:id/runs - Get automation runs
router.get('/:id/runs', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await automationsService.getAutomationRuns(userId, automationId, page, limit);
    
    if (!result.success) {
      return res.status(result.error === 'Automation not found' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching automation runs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch automation runs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Additional routes that might be useful

// GET /api/automations/analytics/overview - Alias for stats/overview
router.get('/analytics/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const result = await automationsService.getAutomationAnalytics(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching automation analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch automation analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/automations/:id/duplicate - Duplicate automation
router.post('/:id/duplicate', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    const { name } = req.body;
    
    // First get the original automation
    const originalResult = await automationsService.getAutomation(userId, automationId);
    if (!originalResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
    }
    
    // Create a duplicate with updated name if provided
    const duplicateData = {
      name: name || `${originalResult.data.name} (Copy)`,
      description: originalResult.data.description,
      triggerType: originalResult.data.triggerType,
      triggerConfig: originalResult.data.triggerConfig,
      flowData: originalResult.data.flowData,
      status: 'draft' as const, // Always set duplicate to draft
    };
    
    const result = await automationsService.createAutomation(userId, duplicateData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Automation duplicated successfully',
    });
  } catch (error) {
    console.error('Error duplicating automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to duplicate automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/automations/:id/trigger - Manually trigger automation
router.post('/:id/trigger', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    const { contactId, triggerData } = req.body;
    
    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID is required'
      });
    }
    
    // First check if automation exists and is active
    const automationResult = await automationsService.getAutomation(userId, automationId);
    if (!automationResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
    }
    
    const automation = automationResult.data;
    
    if (automation.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Automation is not active',
      });
    }

    // Check if contact exists
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.userId, userId)
      ));

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Execute the automation
    const result = await automationExecutionService.triggerAutomation(
      automationId,
      contactId,
      userId,
      triggerData
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: {
        runId: result.executionId,
        automationId,
        contactId,
        status: 'triggered'
      },
      message: 'Automation triggered successfully',
    });
    
  } catch (error) {
    console.error('Error triggering automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to trigger automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/test', async (req: AuthRequest, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user!.userId;
    const { contactId } = req.body; // Allow specifying a test contact
    
    const automationResult = await automationsService.getAutomation(userId, automationId);
    if (!automationResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
    }
    
    const automation = automationResult.data;
    
    // For testing, we'll create a test contact if none provided
    let testContactId = contactId;
    
    if (!testContactId) {
      // Create a test contact
      const [testContact] = await db
        .insert(contacts)
        .values({
          userId,
          name: 'Test Contact',
          phone: '+15551234567', // Test phone number
          email: 'test@example.com',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      testContactId = testContact.id;
    }
    
    // Test the automation
    const result = await automationExecutionService.triggerAutomation(
      automationId,
      testContactId,
      userId,
      { test: true, timestamp: new Date().toISOString() }
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json({
      success: true,
      message: 'Automation test executed successfully',
      data: {
        automationId,
        runId: result.executionId,
        contactId: testContactId,
        status: 'test_executed',
      },
    });
  } catch (error) {
    console.error('Error testing automation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test automation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;