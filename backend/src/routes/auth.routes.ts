//backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', {
      body: req.body,
      headers: req.headers,
      ip: req.ip
    });
    
    const { email, password, name, phone } = req.body;
    
    console.log('Parsed fields:', { email, password, name, phone });
    
    if (!email || !password || !name) {
      console.log('Missing required fields:', { email, password, name });
      return res.status(400).json({ 
        error: 'Email, password, and name are required',
        received: { email, password, name, phone }
      });
    }
    
    console.log('Attempting to register user:', email);
    
    const result = await AuthService.register(email, password, name, phone);
    
    console.log('Registration successful for:', email);
    
    // Store refresh token
    await AuthService.storeRefreshToken(
      result.user.id,
      result.tokens.refreshToken,
      req.headers['user-agent'],
      req.ip
    );
    
    res.json({
      success: true,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (error: any) {
    console.error('Registration error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(400).json({ 
      error: error.message,
      details: error.details || 'Registration failed'
    });
  }
});
// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await AuthService.login(email, password);
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Store refresh token
    await AuthService.storeRefreshToken(
      result.user.id,
      result.tokens.refreshToken,
      req.headers['user-agent'],
      req.ip
    );
    
    res.json({
      success: true,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Validate refresh token
    const isValid = await AuthService.validateRefreshToken(refreshToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Verify JWT
    const payload = AuthService.verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Get user
    const db = getDb();
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = userResult[0];
    
    // Generate new tokens
    const newAccessToken = AuthService.generateAccessToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
    });
    
    const newRefreshToken = AuthService.generateRefreshToken(user.id);
    
    // Revoke old token and store new one
    await AuthService.revokeRefreshToken(refreshToken);
    await AuthService.storeRefreshToken(
      user.id,
      newRefreshToken,
      req.headers['user-agent'],
      req.ip
    );
    
    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await AuthService.revokeRefreshToken(refreshToken);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});


router.get('/google', (req, res) => {
  try {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback')}&response_type=code&scope=profile email&access_type=offline&prompt=consent`;
    
    res.json({ 
      success: true, 
      authUrl,
      redirect: authUrl
    });
  } catch (error: any) {
    console.error('Google auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});


router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    // For now, let's implement a simpler version
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getUserInfo(tokens.access_token);
    
    const db = getDb();
    
    // Find or create user
    let userResult = await db.select()
      .from(users)
      .where(eq(users.email, userInfo.email))
      .limit(1);

    let user;
    
    if (userResult.length === 0) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        email: userInfo.email,
        name: userInfo.name,
        googleId: userInfo.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        avatarUrl: userInfo.picture,
        isActive: true,
        isAdmin: false,
      }).returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
      
      user = newUser;
    } else {
      // Update existing user
      user = userResult[0];
      
      await db.update(users)
        .set({
          googleId: userInfo.id,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
          avatarUrl: userInfo.picture || user.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    
    // Generate our JWT tokens
    const payload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
    };
    
    const accessToken = AuthService.generateAccessToken(payload);
    const refreshToken = AuthService.generateRefreshToken(user.id);
    
    // Store refresh token
    await AuthService.storeRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );
    
    // In production, redirect to frontend
    // For development, return JSON
    res.json({
      success: true,
      user,
      accessToken,
      refreshToken,
    });
    
  } catch (error: any) {
    console.error('Google callback error:', error);
    res.status(400).json({ 
      error: error.message || 'Google authentication failed' 
    });
  }
});


// Google OAuth frontend flow (receives access token from frontend)
router.post('/google/frontend', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    console.log('Received Google access token:', accessToken ? 'Present' : 'Missing');
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Google access token is required' });
    }
    
    // Verify token and get user info from Google
    const userInfo = await getUserInfo(accessToken);
    console.log('Google user info:', userInfo);
    
    const db = getDb();
    
    // Find or create user
    let userResult = await db.select()
      .from(users)
      .where(eq(users.email, userInfo.email))
      .limit(1);

    let user;
    
    if (userResult.length === 0) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        email: userInfo.email,
        name: userInfo.name,
        googleId: userInfo.id,
        googleAccessToken: accessToken,
        avatarUrl: userInfo.picture,
        isActive: true,
        isAdmin: false,
      }).returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
      
      user = newUser;
    } else {
      // Update existing user
      user = userResult[0];
      
      await db.update(users)
        .set({
          googleId: userInfo.id,
          googleAccessToken: accessToken,
          avatarUrl: userInfo.picture || user.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    
    console.log('User created/updated:', user.email);
    
    // Generate our JWT tokens
    const payload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
    };
    
    const jwtAccessToken = AuthService.generateAccessToken(payload);
    const refreshToken = AuthService.generateRefreshToken(user.id);
    
    // Store refresh token
    await AuthService.storeRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );
    
    res.json({
      success: true,
      user,
      accessToken: jwtAccessToken,
      refreshToken,
    });
    
  } catch (error: any) {
    console.error('Google frontend auth error:', error);
    res.status(400).json({ 
      success: false,
      error: error.message || 'Google authentication failed' 
    });
  }
});

// Helper functions
async function exchangeCodeForTokens(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      grant_type: 'authorization_code',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }
  
  return response.json();
}


async function getUserInfo(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }
  
  return response.json();
}


// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { passwordHash, ...userWithoutPassword } = userResult[0];
    
    res.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;