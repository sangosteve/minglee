// backend/src/services/team.service.ts
import { getDb } from '../db/client';
import { teams, teamMembers, teamInvitations, users } from '../db/schema';
import { eq, and, or, desc, not, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { sendTeamInvitationEmail } from '../utils/email';

// Types
export interface TeamSettings {
  canInviteMembers: boolean;
  maxMembers: number;
  allowMemberDeletion: boolean;
  defaultRole: string;
  requireApproval?: boolean;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

export interface InviteMemberData {
  email: string;
  role?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

export interface UpdateMemberData {
  role?: string;
  permissions?: any;
}

export class TeamService {
  private static readonly INVITATION_EXPIRY_DAYS = 7;
  private static readonly MAX_INVITATION_RATE = 10; // per hour per user per team
  private static readonly VALID_ROLES = ['member', 'admin', 'owner', 'viewer'];

  /**
   * Validate role
   */
  private static validateRole(role: string): void {
    if (!this.VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${this.VALID_ROLES.join(', ')}`);
    }
  }

  /**
   * Check if user has permission to perform admin actions
   */
  private static async checkAdminPermission(
    db: any,
    teamId: string,
    userId: string
  ): Promise<boolean> {
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active'),
          or(
            eq(teamMembers.role, 'owner'),
            eq(teamMembers.role, 'admin')
          )
        )
      )
      .limit(1);

    return !!member;
  }

  /**
   * Check if user is team owner
   */
  private static async checkOwnerPermission(
    db: any,
    teamId: string,
    userId: string
  ): Promise<boolean> {
    const [member] = await db.select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.role, 'owner'),
          eq(teamMembers.status, 'active')
        )
      )
      .limit(1);

    return !!member;
  }

  /**
   * Check team member count
   */
  private static async getTeamMemberCount(
    db: any,
    teamId: string
  ): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.status, 'active')
        )
      );

    return result.length > 0 ? Number(result[0]?.count || 0) : 0;
  }

  /**
   * Create a new team
   */
  static async createTeam(userId: string, data: CreateTeamData) {
    const db = getDb();
    
    // Validate input
    if (!data.name?.trim()) {
      throw new Error('Team name is required');
    }
    
    if (data.name.length > 100) {
      throw new Error('Team name must be less than 100 characters');
    }
    
    if (data.description && data.description.length > 500) {
      throw new Error('Description must be less than 500 characters');
    }
    
    const teamSettings: TeamSettings = {
      canInviteMembers: data.settings?.canInviteMembers ?? true,
      maxMembers: data.settings?.maxMembers ?? 50,
      allowMemberDeletion: data.settings?.allowMemberDeletion ?? true,
      defaultRole: data.settings?.defaultRole ?? 'member',
    };
    
    try {
      return await db.transaction(async (tx) => {
        // Create team
        const [team] = await tx.insert(teams).values({
          name: data.name.trim(),
          description: data.description?.trim(),
          ownerId: userId,
          settings: teamSettings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning();
        
        if (!team) {
          throw new Error('Failed to create team');
        }
        
        // Add creator as owner
        await tx.insert(teamMembers).values({
          teamId: team.id,
          userId: userId,
          role: 'owner',
          joinedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        return team;
      });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new Error('A team with this name already exists');
      }
      if (error.code === '23503') { // Foreign key violation
        throw new Error('Invalid user ID');
      }
      
      throw new Error('Failed to create team');
    }
  }
  
  /**
   * Get user's teams
   */
  static async getUserTeams(userId: string) {
    const db = getDb();
    
    try {
      // Single query to get teams with member counts
      const userTeams = await db.select({
        team: teams,
        member: teamMembers,
        memberCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${teamMembers} 
          WHERE ${teamMembers.teamId} = ${teams.id}
          AND ${teamMembers.status} = 'active'
        )`.as('memberCount'),
      })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active')
        )
      )
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .orderBy(desc(teams.createdAt));
      
      return userTeams.map(({ team, member, memberCount }) => ({
        ...team,
        userRole: member.role,
        userStatus: member.status,
        joinedAt: member.joinedAt,
        memberCount: Number(memberCount) || 0,
      }));
    } catch (error: any) {
      throw new Error('Failed to get teams');
    }
  }
  
  /**
   * Get team by ID with members
   */
  static async getTeamById(teamId: string, userId?: string) {
    const db = getDb();
    
    try {
      const [team] = await db.select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      const [members, memberCountResult, userMember] = await Promise.all([
        // Get members
        db.select({
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
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.status, 'active')
          )
        )
        .innerJoin(users, eq(users.id, teamMembers.userId))
        .orderBy(teamMembers.joinedAt),
        
        // Get member count
        db.select({ count: sql<number>`count(*)` })
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.status, 'active')
            )
          ),
        
        // Get user's role if userId provided
        userId ? db.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, userId)
            )
          )
          .limit(1) : Promise.resolve([]),
      ]);
      
      const memberCount = memberCountResult.length > 0 
        ? Number(memberCountResult[0]?.count || 0) 
        : 0;
      
      const userRole = userMember.length > 0 ? userMember[0]?.role || null : null;
      
      return {
        ...team,
        members,
        userRole,
        memberCount,
      };
    } catch (error: any) {
      throw error.message.includes('Team not found') 
        ? new Error('Team not found')
        : new Error('Failed to get team');
    }
  }
  
  /**
   * Update team
   */
  static async updateTeam(teamId: string, userId: string, data: UpdateTeamData) {
    const db = getDb();
    
    // Validate input
    if (data.name && !data.name.trim()) {
      throw new Error('Team name cannot be empty');
    }
    
    if (data.name && data.name.length > 100) {
      throw new Error('Team name must be less than 100 characters');
    }
    
    if (data.description && data.description.length > 500) {
      throw new Error('Description must be less than 500 characters');
    }
    
    try {
      // Verify user is owner
      const isOwner = await this.checkOwnerPermission(db, teamId, userId);
      if (!isOwner) {
        throw new Error('Only team owners can update team');
      }
      
      // Prepare update data
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };
      
      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      
      if (data.description !== undefined) {
        updateData.description = data.description?.trim() || null;
      }
      
      if (data.settings !== undefined) {
        updateData.settings = data.settings;
      }
      
      const [updatedTeam] = await db.update(teams)
        .set(updateData)
        .where(eq(teams.id, teamId))
        .returning();
      
      if (!updatedTeam) {
        throw new Error('Team not found');
      }

      return updatedTeam;
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Delete team
   */
  static async deleteTeam(teamId: string, userId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Verify user is owner
        const isOwner = await this.checkOwnerPermission(tx, teamId, userId);
        if (!isOwner) {
          throw new Error('Only team owners can delete team');
        }
        
        // Get team to confirm it exists
        const [team] = await tx.select()
          .from(teams)
          .where(eq(teams.id, teamId))
          .limit(1);
        
        if (!team) {
          throw new Error('Team not found');
        }
        
        // Delete team members first (due to foreign key constraints)
        await tx.delete(teamMembers)
          .where(eq(teamMembers.teamId, teamId));
        
        // Delete team invitations
        await tx.delete(teamInvitations)
          .where(eq(teamInvitations.teamId, teamId));
        
        // Delete team
        await tx.delete(teams)
          .where(eq(teams.id, teamId));
    
        return { success: true };
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Invite member to team with rate limiting
   */
static async inviteMember(teamId: string, inviterId: string, data: InviteMemberData) {
  const db = getDb();
  
  // Validate input
  if (!data.email?.trim()) {
    throw new Error('Email is required');
  }
  
  const email = data.email.trim().toLowerCase();
  let role = data.role || 'member';
  
  // Validate and normalize role based on your schema constraints
  // Check what roles are allowed in your schema
  const allowedRoles = ['member', 'owner', 'admin', 'manager', 'viewer'];
  
  // If the provided role is not in the allowed list, default to 'member'
  if (!allowedRoles.includes(role)) {
    role = 'member';
  }
  
  try {
    return await db.transaction(async (tx) => {
      // Check if user has permission to invite
      const hasPermission = await this.checkAdminPermission(tx, teamId, inviterId);
      if (!hasPermission) {
        throw new Error('You do not have permission to invite members');
      }
      
      // Get team
      const [team] = await tx.select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        throw new Error('Team not found');
      }
      
      const teamSettings = team.settings as TeamSettings;
      
      // Check if team allows invitations
      if (!teamSettings.canInviteMembers) {
        throw new Error('Team does not allow member invitations');
      }
      
      // Check team member limit
      const currentMemberCount = await this.getTeamMemberCount(tx, teamId);
      if (currentMemberCount >= teamSettings.maxMembers) {
        throw new Error('Team member limit reached');
      }
      
      // Check invitation rate limiting
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentInvitesResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.teamId, teamId),
            eq(teamInvitations.invitedByUserId, inviterId),
            eq(teamInvitations.status, 'pending'),
            sql`${teamInvitations.createdAt} > ${oneHourAgo.toISOString()}`
          )
        );
      
      const recentInvites = recentInvitesResult.length > 0 ? Number(recentInvitesResult[0]?.count || 0) : 0;
      
      if (recentInvites >= this.MAX_INVITATION_RATE) {
        throw new Error('Too many invitations sent recently. Please try again later.');
      }
      
      // Check if user already exists
      const [existingUser] = await tx.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      // Check if already a member
      if (existingUser) {
        const [existingMember] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, existingUser.id),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (existingMember) {
          throw new Error('User is already a team member');
        }
      }
      
      // Check for existing pending invitation
      const [existingInvitation] = await tx.select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.teamId, teamId),
            eq(teamInvitations.email, email),
            eq(teamInvitations.status, 'pending'),
            not(isNull(teamInvitations.expiresAt)),
            sql`${teamInvitations.expiresAt} > ${new Date().toISOString()}`
          )
        )
        .limit(1);
      
      if (existingInvitation) {
        throw new Error('An active invitation already exists for this email');
      }
      
      // Generate invitation token
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.INVITATION_EXPIRY_DAYS);
      
      // Get inviter info
      const [inviter] = await tx.select()
        .from(users)
        .where(eq(users.id, inviterId))
        .limit(1);
      
      // Create invitation - make sure role is one of the allowed values
      const [invitation] = await tx.insert(teamInvitations).values({
        teamId,
        invitedByUserId: inviterId,
        email,
        role: role as 'member' | 'owner' | 'admin' | 'manager' | 'viewer', // Type assertion
        token,
        expiresAt: expiresAt.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning();
      
      if (!invitation) {
        throw new Error('Failed to create invitation');
      }
      
      // Send invitation email asynchronously
      this.sendInvitationEmailAsync(
        email,
        team.name,
        token,
        role,
        expiresAt,
        inviter?.name || 'A team member'
      );
      
      return invitation;
    });
  } catch (error: any) {
    throw error;
  }
}
  
  /**
   * Send invitation email asynchronously
   */
  private static async sendInvitationEmailAsync(
    email: string,
    teamName: string,
    token: string,
    role: string,
    expiresAt: Date,
    inviterName: string
  ) {
    try {
      await sendTeamInvitationEmail(
        email,
        teamName,
        token,
        role,
        expiresAt,
        inviterName
      );
    } catch (emailError: any) {
      // Silent fail - email sending errors shouldn't break the invitation flow
    }
  }
  
  /**
   * Accept invitation
   */
  static async acceptInvitation(token: string, userId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Get invitation
        const [invitation] = await tx.select()
          .from(teamInvitations)
          .where(
            and(
              eq(teamInvitations.token, token),
              eq(teamInvitations.status, 'pending'),
              not(isNull(teamInvitations.expiresAt)),
              sql`${teamInvitations.expiresAt} > ${new Date().toISOString()}`
            )
          )
          .limit(1);
        
        if (!invitation) {
          throw new Error('Invalid, expired, or already accepted invitation');
        }
        
        // Verify user email matches invitation
        const [user] = await tx.select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        
        if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
          throw new Error('This invitation is not for your account');
        }
        
        // Check if already a member
        const [existingMember] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, invitation.teamId),
              eq(teamMembers.userId, userId),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (existingMember) {
          // Update invitation status but don't throw
          await tx.update(teamInvitations)
            .set({
              status: 'already_member',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(teamInvitations.id, invitation.id));
          
          throw new Error('You are already a member of this team');
        }
        
        // Get team to check member limit
        const [team] = await tx.select()
          .from(teams)
          .where(eq(teams.id, invitation.teamId))
          .limit(1);
        
        if (!team) {
          throw new Error('Team no longer exists');
        }
        
        const teamSettings = team.settings as TeamSettings;
        
        // Check member limit
        const currentMemberCount = await this.getTeamMemberCount(tx, invitation.teamId);
        if (currentMemberCount >= teamSettings.maxMembers) {
          throw new Error('Team member limit reached');
        }
        
        // Add user to team
        const [newMember] = await tx.insert(teamMembers).values({
          teamId: invitation.teamId,
          userId,
          role: invitation.role,
          invitedByUserId: invitation.invitedByUserId,
          invitedAt: new Date().toISOString(),
          joinedAt: new Date().toISOString(),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning();
        
        if (!newMember) {
          throw new Error('Failed to join team');
        }
        
        // Update invitation status
        await tx.update(teamInvitations)
          .set({
            status: 'accepted',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(teamInvitations.id, invitation.id));
        
        return {
          team,
          role: invitation.role,
        };
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, memberId: string, removerId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Check if remover has permission
        const hasPermission = await this.checkAdminPermission(tx, teamId, removerId);
        if (!hasPermission) {
          throw new Error('Only owners and admins can remove members');
        }
        
        // Check if removing self
        if (memberId === removerId) {
          throw new Error('You cannot remove yourself. Please use "Leave Team" instead.');
        }
        
        // Check if member exists
        const [member] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, memberId),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (!member) {
          throw new Error('Member not found');
        }
        
        // Prevent removing owners unless it's the last owner
        if (member.role === 'owner') {
          const ownerCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(teamMembers)
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.role, 'owner'),
                eq(teamMembers.status, 'active')
              )
            );
          
          const ownerCount = ownerCountResult.length > 0 ? Number(ownerCountResult[0]?.count || 0) : 0;
          
          if (ownerCount <= 1) {
            throw new Error('Cannot remove the last owner of the team');
          }
        }
        
        // Soft delete member (mark as inactive)
        const [removedMember] = await tx.update(teamMembers)
          .set({
            status: 'inactive',
            leftAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, memberId)
            )
          )
          .returning();
        
        if (!removedMember) {
          throw new Error('Failed to remove member');
        }
        
        return { success: true };
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Leave team
   */
  static async leaveTeam(teamId: string, userId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Check if user is a member
        const [member] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, userId),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (!member) {
          throw new Error('You are not a member of this team');
        }
        
        // Prevent last owner from leaving
        if (member.role === 'owner') {
          const ownerCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(teamMembers)
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.role, 'owner'),
                eq(teamMembers.status, 'active')
              )
            );
          
          const ownerCount = ownerCountResult.length > 0 ? Number(ownerCountResult[0]?.count || 0) : 0;
          
          if (ownerCount <= 1) {
            throw new Error('Cannot leave as the last owner. Transfer ownership first.');
          }
        }
        
        // Soft delete (mark as inactive)
        const [updatedMember] = await tx.update(teamMembers)
          .set({
            status: 'inactive',
            leftAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, userId)
            )
          )
          .returning();
        
        if (!updatedMember) {
          throw new Error('Failed to leave team');
        }
        
        return { success: true };
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Update member role
   */
  static async updateMemberRole(teamId: string, memberId: string, updaterId: string, data: UpdateMemberData) {
    const db = getDb();
    
    // Validate role if provided
    if (data.role) {
      this.validateRole(data.role);
    }
    
    try {
      return await db.transaction(async (tx) => {
        // Check if updater has permission
        const hasPermission = await this.checkAdminPermission(tx, teamId, updaterId);
        if (!hasPermission) {
          throw new Error('Only owners and admins can update member roles');
        }
        
        // Get current member
        const [currentMember] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, memberId),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (!currentMember) {
          throw new Error('Member not found');
        }
        
        // Prevent owners from being demoted if they're the last owner
        if (currentMember.role === 'owner' && data.role !== 'owner') {
          const ownerCountResult = await tx
            .select({ count: sql<number>`count(*)` })
            .from(teamMembers)
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.role, 'owner'),
                eq(teamMembers.status, 'active')
              )
            );
          
          const ownerCount = ownerCountResult.length > 0 ? Number(ownerCountResult[0]?.count || 0) : 0;
          
          if (ownerCount <= 1) {
            throw new Error('Cannot demote the last owner. Transfer ownership first.');
          }
        }
        
        // Update member
        const updateData: any = {
          updatedAt: new Date().toISOString(),
        };
        
        if (data.role !== undefined) {
          updateData.role = data.role;
        }
        
        if (data.permissions !== undefined) {
          updateData.permissions = data.permissions;
        }
        
        const [updatedMember] = await tx.update(teamMembers)
          .set(updateData)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, memberId)
            )
          )
          .returning();
        
        if (!updatedMember) {
          throw new Error('Failed to update member');
        }
        
        return updatedMember;
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Get team invitations
   */
  static async getTeamInvitations(teamId: string, userId: string) {
    const db = getDb();
    
    try {
      // Check if user has permission
      const hasPermission = await this.checkAdminPermission(db, teamId, userId);
      if (!hasPermission) {
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
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Revoke invitation
   */
  static async revokeInvitation(invitationId: string, userId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Get invitation
        const [invitation] = await tx.select()
          .from(teamInvitations)
          .where(eq(teamInvitations.id, invitationId))
          .limit(1);
        
        if (!invitation) {
          throw new Error('Invitation not found');
        }
        
        // Check if user has permission
        // Allow if user is admin/owner OR the one who sent the invitation
        const [member] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, invitation.teamId),
              eq(teamMembers.userId, userId),
              eq(teamMembers.status, 'active'),
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
        const [revoked] = await tx.update(teamInvitations)
          .set({
            status: 'revoked',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(teamInvitations.id, invitationId))
          .returning();
        
        if (!revoked) {
          throw new Error('Failed to revoke invitation');
        }
        
        return revoked;
      });
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * Get user's pending invitations
   */
  static async getUserInvitations(userEmail: string) {
    const db = getDb();
    
    try {
      const invitations = await db.select({
        invitation: teamInvitations,
        team: teams,
        inviter: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.email, userEmail.toLowerCase()),
          eq(teamInvitations.status, 'pending'),
          not(isNull(teamInvitations.expiresAt)),
          sql`${teamInvitations.expiresAt} > ${new Date().toISOString()}`
        )
      )
      .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
      .innerJoin(users, eq(users.id, teamInvitations.invitedByUserId))
      .orderBy(desc(teamInvitations.createdAt));
      
      return invitations.map(({ invitation, team, inviter }) => ({
        ...invitation,
        team,
        inviter,
      }));
    } catch (error: any) {
      throw new Error('Failed to get invitations');
    }
  }
  
  /**
   * Transfer team ownership
   */
  static async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string) {
    const db = getDb();
    
    try {
      return await db.transaction(async (tx) => {
        // Verify current user is owner
        const isOwner = await this.checkOwnerPermission(tx, teamId, currentOwnerId);
        if (!isOwner) {
          throw new Error('Only team owners can transfer ownership');
        }
        
        // Check if new owner is a team member
        const [newOwnerMember] = await tx.select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, newOwnerId),
              eq(teamMembers.status, 'active')
            )
          )
          .limit(1);
        
        if (!newOwnerMember) {
          throw new Error('New owner must be an active team member');
        }
        
        // Update team owner
        await tx.update(teams)
          .set({
            ownerId: newOwnerId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(teams.id, teamId));
        
        // Update roles
        await Promise.all([
          // Demote current owner to admin
          tx.update(teamMembers)
            .set({
              role: 'admin',
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, currentOwnerId)
              )
            ),
          
          // Promote new owner
          tx.update(teamMembers)
            .set({
              role: 'owner',
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, newOwnerId)
              )
            ),
        ]);
        
        return { success: true };
      });
    } catch (error: any) {
      throw error;
    }
  }
}