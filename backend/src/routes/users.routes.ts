// backend/src/routes/users.ts
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { eq, ne, isNotNull } from 'drizzle-orm';

const router = Router();

// GET /api/users/available - Get users available for assignment
router.get('/available', authenticate, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const db = getDb();
    
    // Get all active users (INCLUDING current user)
    const availableUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
      .from(users)
      .where(eq(users.isActive, true))  // Changed from is_active to isActive
      .orderBy(users.name);
    
    res.json({
      success: true,
      users: availableUsers,
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching available users:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch available users',
      details: error.message 
    });
  }
});



export default router;