// src/db/setup.ts
import { db } from "./client";

async function createTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255) DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      contact_id SERIAL,
      body TEXT,
      status VARCHAR(50) DEFAULT 'sent',
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  console.log("✅ Tables created");
}

createTables()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
