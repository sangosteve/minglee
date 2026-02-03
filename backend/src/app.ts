// backend/src/app.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
const cookieParser = require('cookie-parser')

dotenv.config();

// Import routes
import testRoute from "./routes/test";
import contactsRoute from "./routes/contacts.routes";
import authRoutes from "./routes/auth.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import conversationsRoute from "./routes/conversations.routes";
import mediaRoutes from "./routes/media.routes";
import usersRoutes from "./routes/users.routes";
import tagRoutes from "./routes/tags.routes";
import quickRepliesRoutes from './routes/quick-replies.routes';
import analyticsRoutes from './routes/analytics.routes';
import automationRoutes from './routes/automation.routes';
import teamRoutes from './routes/team.routes';
import { getDb } from './db/client';
import templateRoutes from './routes/templates.routes';
import broadcastRoutes from './routes/broadcasts.routes';
const app = express();

// 1. CORS
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true,
}));

app.use(cookieParser());

// 2. Global JSON parsing middleware - Apply to all routes
app.use(express.json({ limit: '50mb' }));

// 3. URL encoded for form submissions
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 50000
}));

// Debug middleware
app.use((req, res, next) => {
  console.log("➡️", req.method, req.url, "BODY:", req.body);
  next();
});

// 4. Routes
app.use("/", testRoute);
app.use("/api/contacts", contactsRoute);
app.use("/api/auth", authRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/conversations", conversationsRoute);
app.use("/api/media", mediaRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/tags", tagRoutes);
app.use('/api/quick-replies', quickRepliesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/broadcasts', broadcastRoutes);

// 5. Health checks
app.get("/health", (_req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    database: "connected"
  });
});

app.get("/api/test", (_req, res) => {
  res.json({ 
    success: true,
    message: "API is working",
    timestamp: new Date().toISOString()
  });
});

// Debug route for invitation testing

app.get('/debug/invitation/:token', async (req, res) => {
  try {
    const db = getDb();
    const { teamInvitations, teams, users } = await import('./db/schema');
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
    .where(
      and(
        eq(teamInvitations.token, req.params.token),
        eq(teamInvitations.status, 'pending')
      )
    )
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .innerJoin(users, eq(users.id, teamInvitations.invitedByUserId))
    .limit(1);
    
    if (!invitation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invitation not found or expired',
        debug: {
          token: req.params.token,
          tableExists: true // Assuming table exists
        }
      });
    }
    
    res.json({ success: true, ...invitation });
  } catch (error: any) {
    console.error('Debug invitation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

export default app;