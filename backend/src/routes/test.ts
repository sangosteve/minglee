import { Router } from "express";
import { getDb } from "../db/client";  // Import getDb instead of db
import { contacts } from "../db/schema";

const router = Router();

router.get("/test-insert", async (_req, res) => {
  try {
    const db = getDb();  // Initialize db here
    
    const inserted = await db.insert(contacts).values({
      name: "Test User",
      phone: "+263777000000",
      email: "test@example.com",
      note: "Inserted via test route",
    }).returning();

    res.json({ success: true, inserted });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;