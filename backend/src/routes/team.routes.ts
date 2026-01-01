// backend/src/routes/team.routes.ts
import { Router } from 'express';
import { TeamService } from '../services/team.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';

const router = Router();

// ========== PROTECTED ROUTES ==========

// Create team
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const team = await TeamService.createTeam(req.user!.userId, req.body);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user's teams
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const teams = await TeamService.getUserTeams(req.user!.userId);
    res.json({ success: true, teams });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get team by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const team = await TeamService.getTeamById(req.params.id, req.user!.userId);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update team
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const team = await TeamService.updateTeam(req.params.id, req.user!.userId, req.body);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete team
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await TeamService.deleteTeam(req.params.id, req.user!.userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Invite member
router.post('/:id/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const invitation = await TeamService.inviteMember(
      req.params.id,
      req.user!.userId,
      req.body
    );
    res.json({ success: true, invitation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Accept invitation - PROTECTED (must be logged in to accept)
router.post('/invitation/:token/accept', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await TeamService.acceptInvitation(req.params.token, req.user!.userId);
    console.log('✅ Invitation accepted for user:', req.user!.userId);
    res.json({ 
      success: true, 
      team: result.team,
      role: result.role 
    });
  } catch (error: any) {
    console.error('❌ Error accepting invitation:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Remove member
router.delete('/:teamId/members/:memberId', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await TeamService.removeMember(
      req.params.teamId,
      req.params.memberId,
      req.user!.userId
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Leave team
router.post('/:id/leave', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await TeamService.leaveTeam(req.params.id, req.user!.userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update member role
router.put('/:teamId/members/:memberId/role', authenticate, async (req: AuthRequest, res) => {
  try {
    const member = await TeamService.updateMemberRole(
      req.params.teamId,
      req.params.memberId,
      req.user!.userId,
      req.body
    );
    res.json({ success: true, member });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get team invitations
router.get('/:id/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const invitations = await TeamService.getTeamInvitations(req.params.id, req.user!.userId);
    res.json({ success: true, invitations });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Revoke invitation - FIXED: Changed from /invitation/:id to /invitations/:id
router.delete('/invitations/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const invitation = await TeamService.revokeInvitation(req.params.id, req.user!.userId);
    res.json({ success: true, invitation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== PUBLIC ROUTES ==========

// Get invitation by token - PUBLIC (no authentication required)
router.get('/invitation/:token', async (req, res) => {
  try {
    const db = getDb();
    const { teamInvitations, teams, users, teamMembers } = await import('../db/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const [invitation] = await db.select({
      invitation: teamInvitations,
      team: teams,
      inviter: {
        id: users.id,
        name: users.name,
        email: users.email,
      }
    })
    .from(teamInvitations)
    .where(eq(teamInvitations.token, req.params.token))
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .innerJoin(users, eq(users.id, teamInvitations.invitedByUserId))
    .limit(1);
    
    if (!invitation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invitation not found'
      });
    }
    
    // Check if invitation is expired
    const isExpired = new Date(invitation.invitation.expiresAt) < new Date();
    const isValid = invitation.invitation.status === 'pending' && !isExpired;
    
    // If user is authenticated, check if they're already a member
    let isAlreadyMember = false;
    let currentUserId = null;
    
    // Try to get user from auth if available
    try {
      // Check if there's an auth header
      const authHeader = req.headers.authorization;
      if (authHeader) {
        // You might want to verify the token here or use your auth middleware
        // For now, just pass the info to frontend
        const { verifyToken } = await import('../utils/jwt');
        const token = authHeader.replace('Bearer ', '');
        const decoded = verifyToken(token);
        if (decoded) {
          currentUserId = decoded.userId;
          
          // Check if user is already a member
          const [existingMember] = await db.select()
            .from(teamMembers)
            .where(
              and(
                eq(teamMembers.teamId, invitation.team.id),
                eq(teamMembers.userId, currentUserId)
              )
            )
            .limit(1);
          
          isAlreadyMember = !!existingMember;
        }
      }
    } catch (authError) {
      // Silently fail - user is not authenticated
    }
    
    res.json({ 
      success: true, 
      ...invitation,
      meta: {
        isExpired,
        isValid,
        isAlreadyMember,
        canAccept: isValid && !isAlreadyMember,
        status: invitation.invitation.status
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message,
      code: error.code
    });
  }
});

export default router;