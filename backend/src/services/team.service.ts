// backend/src/services/team.service.ts
import { getDb } from '../db/client';
import { teams, teamMembers, teamInvitations, users } from '../db/schema';
import { eq, and, or, desc, not, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { sendTeamInvitationEmail } from '../utils/email';

export interface CreateTeamData {
  name: string;
  description?: string;
  settings?: {
    canInviteMembers?: boolean;
    maxMembers?: number;
    allowMemberDeletion?: boolean;
    defaultRole?: string;
  };
}

export interface InviteMemberData {
  email: string;
  role?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  settings?: any;
}

export interface UpdateMemberData {
  role?: string;
  permissions?: any;
}

export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(userId: string, data: CreateTeamData) {
    const db = getDb();
    
    try {
      // Create team
      const [team] = await db.insert(teams).values({
        name: data.name,
        description: data.description,
        ownerId: userId,
        settings: {
          canInviteMembers: data.settings?.canInviteMembers ?? true,
          maxMembers: data.settings?.maxMembers ?? 10,
          allowMemberDeletion: data.settings?.allowMemberDeletion ?? false,
          defaultRole: data.settings?.defaultRole ?? 'member',
        },
      }).returning();
      
      // Add creator as owner
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: userId,
        role: 'owner',
        joinedAt: new Date(),
      });
      
      return team;
    } catch (error: any) {
      console.error('Error creating team:', error);
      
      // Check for specific database errors
      if (error.code === '23505') { // Unique violation
        throw new Error('A team with this name already exists');
      } else if (error.code === '23503') { // Foreign key violation
        throw new Error('Invalid user ID');
      } else if (error.message.includes('violates not-null constraint')) {
        throw new Error('Missing required field: ' + error.message);
      } else if (error.message.includes('violates check constraint')) {
        throw new Error('Invalid data: ' + error.message);
      }
      
      throw new Error('Failed to create team: ' + error.message);
    }
  }
  
  /**
   * Get user's teams
   */
static async getUserTeams(userId: string) {
  const db = getDb();
  
  const userTeams = await db.select({
    team: teams,
    member: teamMembers,
  })
  .from(teamMembers)
  .where(eq(teamMembers.userId, userId))
  .innerJoin(teams, eq(teams.id, teamMembers.teamId))
  .orderBy(desc(teams.createdAt));
  
  // Format response
  const formattedTeams = userTeams.map(({ team, member }) => ({
    ...team,
    userRole: member.role,
    userStatus: member.status,
    joinedAt: member.joinedAt,
    // Don't include full members list here to keep response small
  }));
  
  // Get member counts for each team
  for (const team of formattedTeams) {
    const [memberCountResult] = await db.select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));
    
    team.memberCount = memberCountResult?.count || 0;
  }
  
  return formattedTeams;
}
  
  /**
   * Get team by ID with members
   */
static async getTeamById(teamId: string, userId?: string) {
  const db = getDb();
  
  // Get team
  const [team] = await db.select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Get members
  const members = await db.select({
    id: teamMembers.id,
    role: teamMembers.role,
    status: teamMembers.status,
    joinedAt: teamMembers.joinedAt,
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    }
  })
  .from(teamMembers)
  .where(eq(teamMembers.teamId, teamId))
  .innerJoin(users, eq(users.id, teamMembers.userId))
  .orderBy(teamMembers.joinedAt);
  
  // Get member count
  const [memberCountResult] = await db.select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  
  // Get user's role if userId provided
  let userRole = null;
  if (userId) {
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      )
      .limit(1);
    
    userRole = member?.role;
  }
  
  return {
    ...team,
    members, // Make sure this is included
    userRole,
    memberCount: memberCountResult?.count || members.length,
  };
}
  
  /**
   * Update team
   */
  static async updateTeam(teamId: string, userId: string, data: UpdateTeamData) {
    const db = getDb();
    
    // Verify user is owner
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.role, 'owner')
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('Only team owners can update team');
    }
    
    const [updatedTeam] = await db.update(teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();
    
    return updatedTeam;
  }
  
  /**
   * Delete team
   */
  static async deleteTeam(teamId: string, userId: string) {
    const db = getDb();
    
    // Verify user is owner
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.role, 'owner')
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('Only team owners can delete team');
    }
    
    await db.delete(teams).where(eq(teams.id, teamId));
    
    return { success: true };
  }
  
  /**
   * Invite member to team
   */
  static async inviteMember(teamId: string, inviterId: string, data: InviteMemberData) {
    const db = getDb();
    
    // Check if user has permission to invite
    const [inviterMember] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, inviterId),
          or(
            eq(teamMembers.role, 'owner'),
            eq(teamMembers.role, 'admin')
          )
        )
      )
      .limit(1);
    
    if (!inviterMember) {
      throw new Error('You do not have permission to invite members');
    }
    
    // Check team member limit
    const team = await this.getTeamById(teamId);
    if (team.memberCount >= (team.settings?.maxMembers || 10)) {
      throw new Error('Team member limit reached');
    }
    
    // Check if user already exists
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);
    
    // Check if already a member
    if (existingUser) {
      const [existingMember] = await db.select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, existingUser.id)
          )
        )
        .limit(1);
      
      if (existingMember) {
        throw new Error('User is already a team member');
      }
    }
    
    // Generate invitation token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
    
    // Get inviter info for email
    const [inviter] = await db.select()
      .from(users)
      .where(eq(users.id, inviterId))
      .limit(1);
    
    // Create invitation
    const [invitation] = await db.insert(teamInvitations).values({
      teamId,
      invitedByUserId: inviterId,
      email: data.email,
      role: data.role || 'member',
      token,
      expiresAt,
    }).returning();
    
    console.log('📧 Attempting to send invitation email to:', data.email);
    console.log('📧 Team:', team.name);
    console.log('📧 Token:', token);
    console.log('📧 Role:', data.role || 'member');
    console.log('📧 Expires:', expiresAt);
    console.log('📧 Inviter:', inviter?.name);
    
    try {
      // Send invitation email using the new email utility
      const emailResult = await sendTeamInvitationEmail(
        data.email,
        team.name,
        token,
        data.role || 'member',
        expiresAt,
        inviter?.name
      );
      
      console.log('📧 Email sending result:', {
        success: emailResult.success,
        messageId: emailResult.messageId,
        error: emailResult.error
      });
      
      if (!emailResult.success) {
        console.warn('⚠️ Email sending failed, but invitation was created. Error:', emailResult.error);
        // Still return the invitation even if email fails
      }
      
    } catch (emailError: any) {
      console.error('❌ Error sending invitation email:', emailError.message);
      console.error('❌ Error stack:', emailError.stack);
      // Don't throw - still return the invitation
    }
    
    return invitation;
  }
  
  /**
   * Accept invitation
   */

static async acceptInvitation(token: string, userId: string) {
  const db = getDb();
  
  // Get invitation - include accepted invitations too for checking
  const [invitation] = await db.select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.token, token),
        not(isNull(teamInvitations.expiresAt))
      )
    )
    .limit(1);
  
  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }
  
  // Check if already accepted
  if (invitation.status !== 'pending') {
    throw new Error(`Invitation has already been ${invitation.status}`);
  }
  
  if (new Date(invitation.expiresAt) < new Date()) {
    throw new Error('Invitation has expired');
  }
  
  // Verify user email matches invitation
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user || user.email !== invitation.email) {
    throw new Error('This invitation is not for your account');
  }
  
  // Check if already a member
  const [existingMember] = await db.select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, invitation.teamId),
        eq(teamMembers.userId, userId)
      )
    )
    .limit(1);
  
  if (existingMember) {
    throw new Error('You are already a member of this team');
  }
  
  try {
    // 1. Add user to team
    const [newMember] = await db.insert(teamMembers).values({
      teamId: invitation.teamId,
      userId,
      role: invitation.role,
      invitedByUserId: invitation.invitedByUserId,
      invitedAt: new Date(),
      joinedAt: new Date(),
    }).returning();
    
    if (!newMember) {
      throw new Error('Failed to add user to team');
    }
    
    // 2. Update invitation status
    await db.update(teamInvitations)
      .set({
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(teamInvitations.id, invitation.id));
    
    // 3. Get team info
    const [team] = await db.select()
      .from(teams)
      .where(eq(teams.id, invitation.teamId))
      .limit(1);
    
    return {
      team,
      role: invitation.role,
    };
    
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    throw new Error('Failed to accept invitation: ' + error.message);
  }
}
  
  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, memberId: string, removerId: string) {
    const db = getDb();
    
    // Check if remover has permission
    const [removerMember] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, removerId)
        )
      )
      .limit(1);
    
    if (!removerMember) {
      throw new Error('You are not a member of this team');
    }
    
    // Check if removing self
    if (memberId === removerId) {
      throw new Error('You cannot remove yourself. Please use "Leave Team" instead.');
    }
    
    // Check if remover is owner/admin
    if (!['owner', 'admin'].includes(removerMember.role)) {
      throw new Error('Only owners and admins can remove members');
    }
    
    // Check if member exists
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, memberId)
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('Member not found');
    }
    
    // Prevent removing owners unless it's the last owner
    if (member.role === 'owner') {
      const [ownerCount] = await db.select({ count: sql<number>`count(*)` })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.role, 'owner')
          )
        );
      
      if (ownerCount.count <= 1) {
        throw new Error('Cannot remove the last owner of the team');
      }
    }
    
    // Remove member
    await db.delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, memberId)
        )
      );
    
    return { success: true };
  }
  
  /**
   * Leave team
   */
  static async leaveTeam(teamId: string, userId: string) {
    const db = getDb();
    
    // Check if user is a member
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('You are not a member of this team');
    }
    
    // Prevent last owner from leaving
    if (member.role === 'owner') {
      const [ownerCount] = await db.select({ count: sql<number>`count(*)` })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.role, 'owner')
          )
        );
      
      if (ownerCount.count <= 1) {
        throw new Error('Cannot leave as the last owner. Transfer ownership first.');
      }
    }
    
    // Leave team
    await db.update(teamMembers)
      .set({
        status: 'inactive',
        leftAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      );
    
    return { success: true };
  }
  
  /**
   * Update member role
   */
  static async updateMemberRole(teamId: string, memberId: string, updaterId: string, data: UpdateMemberData) {
    const db = getDb();
    
    // Check if updater has permission
    const [updaterMember] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, updaterId),
          or(
            eq(teamMembers.role, 'owner'),
            eq(teamMembers.role, 'admin')
          )
        )
      )
      .limit(1);
    
    if (!updaterMember) {
      throw new Error('Only owners and admins can update member roles');
    }
    
    // Prevent owners from being demoted if they're the last owner
    const [currentMember] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, memberId)
        )
      )
      .limit(1);
    
    if (currentMember?.role === 'owner' && data.role !== 'owner') {
      const [ownerCount] = await db.select({ count: sql<number>`count(*)` })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.role, 'owner')
          )
        );
      
      if (ownerCount.count <= 1) {
        throw new Error('Cannot demote the last owner. Transfer ownership first.');
      }
    }
    
    // Update member
    const [updatedMember] = await db.update(teamMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, memberId)
        )
      )
      .returning();
    
    return updatedMember;
  }
  
  /**
   * Get team invitations
   */
  static async getTeamInvitations(teamId: string, userId: string) {
    const db = getDb();
    
    // Check if user has permission
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          or(
            eq(teamMembers.role, 'owner'),
            eq(teamMembers.role, 'admin')
          )
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('You do not have permission to view invitations');
    }
    
    const invitations = await db.select({
      invitation: teamInvitations,
      inviter: {
        id: users.id,
        name: users.name,
        email: users.email,
      }
    })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, 'pending')
      )
    )
    .innerJoin(users, eq(users.id, teamInvitations.invitedByUserId))
    .orderBy(desc(teamInvitations.createdAt));
    
    return invitations.map(({ invitation, inviter }) => ({
      ...invitation,
      inviter,
    }));
  }
  
  /**
   * Revoke invitation
   */
  static async revokeInvitation(invitationId: string, userId: string) {
    const db = getDb();
    
    // Get invitation
    const [invitation] = await db.select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId))
      .limit(1);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    // Check if user has permission
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, invitation.teamId),
          eq(teamMembers.userId, userId),
          or(
            eq(teamMembers.role, 'owner'),
            eq(teamMembers.role, 'admin'),
            eq(teamMembers.userId, invitation.invitedByUserId)
          )
        )
      )
      .limit(1);
    
    if (!member) {
      throw new Error('You do not have permission to revoke this invitation');
    }
    
    // Revoke invitation
    const [revoked] = await db.update(teamInvitations)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(teamInvitations.id, invitationId))
      .returning();
    
    return revoked;
  }
}