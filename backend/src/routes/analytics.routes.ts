import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getContactsOverview } from '../services/analytics.service';

const router = Router();

// GET /api/analytics/contacts/overview
router.get('/contacts/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    console.log('🔎 analytics overview called for user:', userId);
    const analytics = await getContactsOverview(userId);
    res.json({ success: true, analytics });
  } catch (error: any) {
    console.error('Error in analytics overview route:', error?.message || error, error?.stack || '');
    res.status(500).json({ success: false, error: 'Failed to fetch contact analytics' });
  }
});

export default router;