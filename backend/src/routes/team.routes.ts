// backend/src/routes/team.routes.ts
import { Router } from 'express';
import { TeamService } from '../services/team.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { getDb } from '../db/client';
import { teamInvitations, teams, users, teamMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Helper function to safely get user ID
const getUserId = (req: AuthRequest): string => {
  if (!req.user?.userId) {
    throw new Error('Authentication required');
  }
  return req.user.userId;
};

// Helper function to safely get param
const getParam = (params: any, key: string): string => {
  const value = params[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing or invalid ${key}`);
  }
  return value;
};

// Simple JWT verification function (replace with your actual implementation)
const verifyToken = (token: string): any => {
  try {
    // This is a placeholder - implement your actual JWT verification
    // Example with jsonwebtoken:
    // import jwt from 'jsonwebtoken';
    // return jwt.verify(token, process.env.JWT_SECRET!);
    
    console.warn('⚠️ JWT verification not implemented. Using placeholder.');
    return { userId: 'placeholder-user-id' };
  } catch (error) {
    return null;
  }
};

// ========== PROTECTED ROUTES ==========

// Create team
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const team = await TeamService.createTeam(userId, req.body);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user's teams
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const userTeams = await TeamService.getUserTeams(userId);
    res.json({ success: true, teams: userTeams });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get team by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const team = await TeamService.getTeamById(teamId, userId);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update team
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const team = await TeamService.updateTeam(teamId, userId, req.body);
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete team
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const result = await TeamService.deleteTeam(teamId, userId);
    res.json({...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Invite member
router.post('/:id/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const invitation = await TeamService.inviteMember(teamId, userId, req.body);
    res.json({ success: true, invitation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Accept invitation - PROTECTED (must be logged in to accept)
router.post('/invitation/:token/accept', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const token = req.params.token;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation token is required' 
      });
    }
    
    const result = await TeamService.acceptInvitation(token, userId);
    console.log('✅ Invitation accepted for user:', userId);
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
    const userId = getUserId(req);
    const teamId = req.params.teamId;
    const memberId = req.params.memberId;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Member ID is required' 
      });
    }
    
    const result = await TeamService.removeMember(teamId, memberId, userId);
    res.json({...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Leave team
router.post('/:id/leave', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const result = await TeamService.leaveTeam(teamId, userId);
    res.json({ ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update member role
router.put('/:teamId/members/:memberId/role', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.teamId;
    const memberId = req.params.memberId;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Member ID is required' 
      });
    }
    
    const member = await TeamService.updateMemberRole(teamId, memberId, userId, req.body);
    res.json({ success: true, member });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get team invitations
router.get('/:id/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const teamId = req.params.id;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team ID is required' 
      });
    }
    
    const invitations = await TeamService.getTeamInvitations(teamId, userId);
    res.json({ success: true, invitations });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Revoke invitation
router.delete('/invitations/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const invitationId = req.params.id;
    
    if (!invitationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation ID is required' 
      });
    }
    
    const invitation = await TeamService.revokeInvitation(invitationId, userId);
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
    const token = req.params.token;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation token is required' 
      });
    }
    
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
    .where(eq(teamInvitations.token, token))
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
    
    // Try to get user from auth if available
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      
      if (decoded?.userId) {
        // Check if user is already a member
        const [existingMember] = await db.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, invitation.team.id),
              eq(teamMembers.userId, decoded.userId)
            )
          )
          .limit(1);
        
        isAlreadyMember = !!existingMember;
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        invitation: invitation.invitation,
        team: invitation.team,
        inviter: invitation.inviter,
        meta: {
          isExpired,
          isValid,
          isAlreadyMember,
          canAccept: isValid && !isAlreadyMember,
          status: invitation.invitation.status
        }
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to fetch invitation'
    });
  }
});

export default router;