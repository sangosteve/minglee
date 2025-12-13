//backend/src/db/client.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export const getDb = () => {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is not set. " +
        "Please check your .env file and make sure it's in the backend root directory."
      );
    }
    
    const sql = neon(databaseUrl);
    dbInstance = drizzle(sql);
  }
  
  return dbInstance;
};

// Optional: Keep the default export for backward compatibility
export const db = getDb();