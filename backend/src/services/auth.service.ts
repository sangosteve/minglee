// backend/src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/client';
import { users, refreshTokens } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate access token
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );
  }

  // Generate refresh token
  static generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' } as jwt.SignOptions
    );
  }

  // Verify access token
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch {
      return null;
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    } catch {
      return null;
    }
  }

  // Store refresh token
  static async storeRefreshToken(
    userId: string, 
    token: string, 
    userAgent?: string, 
    ipAddress?: string
  ) {
    const db = getDb();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt: expiresAt.toISOString(), // Convert to string
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      isRevoked: false,
    });
  }

  // Revoke refresh token
  static async revokeRefreshToken(token: string) {
    const db = getDb();
    await db.update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, token));
  }

  // Validate refresh token
  static async validateRefreshToken(token: string): Promise<boolean> {
    const db = getDb();
    
    const tokenRecord = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1);

    if (tokenRecord.length === 0 || !tokenRecord[0]) return false;
    
    const record = tokenRecord[0];
    
    // Check if record exists and has required properties
    if (!record || !record.expiresAt || record.isRevoked === undefined) {
      return false;
    }
    
    return !record.isRevoked && new Date(record.expiresAt) > new Date();
  }

  // Login user
  static async login(
    email: string, 
    password: string
  ): Promise<{ user: any; tokens: AuthTokens } | null> {
    const db = getDb();
    
    // Find user
    const userResult = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0 || !userResult[0]) return null;
    
    const user = userResult[0];
    
    // Check if user has password hash
    if (!user.passwordHash) return null;
    
    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) return null;
    
    // Check if user is active
    if (!user.isActive) return null;
    
    // Generate tokens
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
    };
    
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(user.id);
    
    // Remove password hash from user object
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      tokens: { accessToken, refreshToken }
    };
  }

  // Register new user
  static async register(
    email: string, 
    password: string, 
    name: string, 
    phone?: string
  ): Promise<{ user: any; tokens: AuthTokens }> {
    const db = getDb();
    
    // Check if user exists
    const existing = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const passwordHash = await this.hashPassword(password);
    
    // Create user
    const newUserResult = await db.insert(users).values({
      email,
      passwordHash,
      name,
      phone: phone || null,
      isActive: true,
      isAdmin: false,
    }).returning();

    if (newUserResult.length === 0 || !newUserResult[0]) {
      throw new Error('Failed to create user');
    }
    
    const newUser = newUserResult[0];
    
    // Generate tokens
    const payload: TokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      isAdmin: false,
    };
    
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(newUser.id);
    
    // Remove password hash
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    
    return {
      user: userWithoutPassword,
      tokens: { accessToken, refreshToken }
    };
  }
}