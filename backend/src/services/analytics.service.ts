import { getDb } from '../db/client';
import { contacts, tags } from '../db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

export async function getContactsOverview(userId: string) {
  const db = getDb();
  console.log('getContactsOverview called for user:', userId);

  try {
    // Total contacts
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(eq(contacts.userId, userId));
    const total = totalResult.length > 0 ? Number(totalResult[0]?.count ?? 0) : 0;

    // Contacts by status
    const byStatusResult = await db.select({ status: contacts.status, count: sql<number>`count(*)` })
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .groupBy(contacts.status);

    // Contacts by city (non-empty)
    const byCityResult = await db.select({ city: contacts.city, count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), sql`${contacts.city} != ''`))
      .groupBy(contacts.city)
      .orderBy(contacts.city)
      .limit(10);

    // Tag aggregation (fallback to JS aggregation)
    const contactsWithTags = await db.select({ tagIds: contacts.tagIds })
      .from(contacts)
      .where(eq(contacts.userId, userId));

    const counts: Record<string, number> = {};
    for (const c of contactsWithTags) {
      const ids = c.tagIds || [];
      for (const id of ids) {
        if (!id) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
    }

    const tagIds = Object.keys(counts);
    let byTag: Array<{ tag: string; tagId: string; count: number; color?: string }> = [];
    if (tagIds.length > 0) {
      const tagDetails = await db.select().from(tags).where(and(inArray(tags.id, tagIds), eq(tags.userId, userId)));
      byTag = tagIds.sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).map(id => {
        const tag = tagDetails.find(t => t.id === id);
        return {
          tag: tag?.name || id,
          tagId: id,
          count: Number(counts[id] || 0),
          color: tag?.color || '#3B82F6',
        };
      });
    }

    // New contacts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonthResult = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), sql`${contacts.createdAt} >= ${startOfMonth}`));

    const newThisMonth = newThisMonthResult.length > 0 ? Number(newThisMonthResult[0]?.count ?? 0) : 0;

    return {
      total,
      byStatus: byStatusResult.map((r: any) => ({ status: r.status, count: Number(r.count) })),
      byCity: byCityResult.map((r: any) => ({ city: r.city, count: Number(r.count) })),
      byTag,
      newThisMonth,
    };
  } catch (err: any) {
    console.error('Error in getContactsOverview:', err.message || err, err.stack || '');
    throw err;
  }
}
