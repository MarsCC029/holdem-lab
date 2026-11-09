import { openDB, type IDBPDatabase } from 'idb';
import type { HandRecord } from '../engine/replay';
import type { HandGrade } from '../analysis/gradeHand';

/** One completed hand: enough to replay, regrade, and aggregate stats. */
export interface StoredHand {
  handId: string;
  timestamp: number;
  record: HandRecord;
  heroSeatIndex: number;
  grade: HandGrade;
  /** Hero's chip result for the hand. */
  net: number;
}

const DB_NAME = 'poker-mentor';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        const store = d.createObjectStore('hands', { keyPath: 'handId' });
        store.createIndex('timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export async function saveHand(hand: StoredHand): Promise<void> {
  await (await db()).put('hands', hand);
}

/** Most recent hands first. */
export async function listHands(limit = 100): Promise<StoredHand[]> {
  const d = await db();
  const out: StoredHand[] = [];
  let cursor = await d.transaction('hands').store.index('timestamp').openCursor(null, 'prev');
  while (cursor && out.length < limit) {
    out.push(cursor.value as StoredHand);
    cursor = await cursor.continue();
  }
  return out;
}

export async function getHand(handId: string): Promise<StoredHand | undefined> {
  return (await db()).get('hands', handId) as Promise<StoredHand | undefined>;
}

export async function countHands(): Promise<number> {
  return (await db()).count('hands');
}

export async function clearHands(): Promise<void> {
  await (await db()).clear('hands');
}
