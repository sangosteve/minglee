// backend/src/app.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

import testRoute from "./routes/test";
import contactsRoute from "./routes/contacts";
import authRoutes from "./routes/auth.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import conversationsRoute from "./routes/conversations.routes";
import mediaRoutes from "./routes/media.routes";
import usersRoutes from "./routes/users.routes";
import tagRoutes from "./routes/tags.routes";
import quickRepliesRoutes from './routes/quick-replies.routes';
import analyticsRoutes from './routes/analytics.routes';
import automationRoutes from './routes/automation.routes';

const app = express();

// 1. CORS
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true,
}));

app.use(cookieParser());

// 2. URL encoded for form submissions
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 50000
}));


// 3. Add JSON parsing ONLY to routes that don't use FormData
// Apply JSON parsing to specific route prefixes
app.use([
  "/api/contacts",
  "/api/auth", 
  "/api/conversations",
  "/api/whatsapp/send",
  "/api/whatsapp/config",
  "/api/whatsapp/conversations",
  "/api/automations",
  "/api/whatsapp/webhook", 
  "/api/users",
  "/api/tags",
  "/api/whatsapp/health",
  "/api/quick-replies",
  "/api/analytics"
], express.json({ limit: '50mb' }));

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

// Temporary debug route to test analytics service directly
import { getContactsOverview } from './services/analytics.service';
app.get('/internal-debug/analytics/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('DEBUG: calling getContactsOverview for', userId);
    const result = await getContactsOverview(userId);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('DEBUG: analytics service error:', err?.message || err, err?.stack || '');
    res.status(500).json({ success: false, error: err?.message || 'failed' });
  }
});

export default app;