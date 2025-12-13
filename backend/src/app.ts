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

const app = express();

// 1. CORS
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true,
}));

app.use(cookieParser());

// 2. Add JSON parsing ONLY to routes that don't use FormData
// Apply JSON parsing to specific route prefixes
app.use([
  "/api/contacts",
  "/api/auth", 
  "/api/conversations",
  "/api/whatsapp/send", // Only the text send route
  "/api/whatsapp/config",
  "/api/whatsapp/conversations",
  "/api/whatsapp/health"
], express.json({ limit: '50mb' }));

// 3. URL encoded for form submissions (not multipart)
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 50000
}));

// 4. Routes
app.use("/", testRoute);
app.use("/api/contacts", contactsRoute);
app.use("/api/auth", authRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/conversations", conversationsRoute);
app.use("/api/media", mediaRoutes);

// 5. Health check
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

export default app;