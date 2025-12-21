import { getDb } from '../src/db/client';
import { sql } from 'drizzle-orm';

(async () => {
  try {
    const db = getDb();
    const userId = '6fa80266-55be-4e84-a428-b1512fb76f13'; // test user

    console.log('Running tag aggregation test for user:', userId);

    const byTagRaw = await db.execute(sql`
      SELECT tag_id, COUNT(*) as count
      FROM contacts, unnest(contacts.tag_ids) as tag_id
      WHERE contacts.user_id = ${userId}
      AND tag_id IS NOT NULL
      GROUP BY tag_id
      ORDER BY count DESC
    `);

    console.log('Raw tag aggregation:', byTagRaw.rows || byTagRaw);

    process.exit(0);
  } catch (err: any) {
    console.error('Query failed:', err.message || err);
    console.error(err.stack);
    process.exit(1);
  }
})();