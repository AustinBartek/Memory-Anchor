import * as SQLite from 'expo-sqlite';
import { RawLocationPoint, PlaceVisit, DailyRecallSummary } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('memory_anchor.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS raw_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      dateString TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS place_visits (
      id TEXT PRIMARY KEY,
      dateString TEXT NOT NULL,
      placeName TEXT NOT NULL,
      address TEXT NOT NULL,
      category TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      durationMinutes INTEGER NOT NULL,
      assumedActivities TEXT NOT NULL,
      cognitiveHint TEXT NOT NULL,
      userRecalledNote TEXT,
      recalledIndependently INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_recall_summaries (
      dateString TEXT PRIMARY KEY,
      freeRecallText TEXT NOT NULL DEFAULT '',
      completedAt INTEGER,
      recallScorePercent REAL
    );
  `);
}

export async function insertRawLocation(point: RawLocationPoint): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO raw_locations (latitude, longitude, timestamp, dateString) VALUES (?, ?, ?, ?)`,
    [point.latitude, point.longitude, point.timestamp, point.dateString]
  );
}

export async function getRawLocationsByDate(dateString: string): Promise<RawLocationPoint[]> {
  const database = await getDatabase();
  return await database.getAllAsync<RawLocationPoint>(
    `SELECT * FROM raw_locations WHERE dateString = ? ORDER BY timestamp ASC`,
    [dateString]
  );
}

export async function savePlaceVisit(visit: PlaceVisit): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO place_visits 
     (id, dateString, placeName, address, category, latitude, longitude, startTime, endTime, durationMinutes, assumedActivities, cognitiveHint, userRecalledNote, recalledIndependently)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visit.id,
      visit.dateString,
      visit.placeName,
      visit.address,
      visit.category,
      visit.latitude,
      visit.longitude,
      visit.startTime,
      visit.endTime,
      visit.durationMinutes,
      JSON.stringify(visit.assumedActivities),
      visit.cognitiveHint,
      visit.userRecalledNote ?? '',
      visit.recalledIndependently ? 1 : 0,
    ]
  );
}

export async function getPlaceVisitsByDate(dateString: string): Promise<PlaceVisit[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM place_visits WHERE dateString = ? ORDER BY startTime ASC`,
    [dateString]
  );
  return rows.map((row) => ({
    ...row,
    assumedActivities: JSON.parse(row.assumedActivities || '[]'),
    recalledIndependently: Boolean(row.recalledIndependently),
  }));
}

/**
 * Saves or updates a user's DailyRecallSummary for a given day, including their
 * free-recall reflection text, completion timestamp, recall score, and associated visits.
 */
export async function saveRecallSummary(summary: DailyRecallSummary): Promise<void> {
  const database = await getDatabase();

  // Compute recall score automatically if visits exist and score isn't explicitly passed
  const totalVisits = summary.visits.length;
  const rememberedCount = summary.visits.filter((v) => v.recalledIndependently).length;
  const computedScore =
    summary.recallScorePercent !== undefined
      ? summary.recallScorePercent
      : totalVisits > 0
        ? Math.round((rememberedCount / totalVisits) * 100)
        : 0;

  await database.runAsync(
    `INSERT OR REPLACE INTO daily_recall_summaries
     (dateString, freeRecallText, completedAt, recallScorePercent)
     VALUES (?, ?, ?, ?)`,
    [
      summary.dateString,
      summary.freeRecallText,
      summary.completedAt ?? Date.now(),
      computedScore,
    ]
  );

  // Ensure any updated visit states (e.g. recalledIndependently or userRecalledNote) are also saved
  for (const visit of summary.visits) {
    await savePlaceVisit(visit);
  }
}

/**
 * Finds a DailyRecallSummary by its dateString (YYYY-MM-DD), joining its stored
 * reflection metadata with all PlaceVisits recorded for that date.
 */
export async function getRecallSummaryByDate(
  dateString: string
): Promise<DailyRecallSummary | null> {
  const database = await getDatabase();

  const summaryRow = await database.getFirstAsync<{
    dateString: string;
    freeRecallText: string;
    completedAt: number | null;
    recallScorePercent: number | null;
  }>(
    `SELECT * FROM daily_recall_summaries WHERE dateString = ?`,
    [dateString]
  );

  const visits = await getPlaceVisitsByDate(dateString);

  // If neither a saved summary row nor any visits exist for this date, return null
  if (!summaryRow && visits.length === 0) {
    return null;
  }

  const rememberedCount = visits.filter((v) => v.recalledIndependently).length;
  const fallbackScore =
    visits.length > 0 ? Math.round((rememberedCount / visits.length) * 100) : 0;

  return {
    dateString,
    visits,
    freeRecallText: summaryRow?.freeRecallText ?? '',
    completedAt: summaryRow?.completedAt ?? undefined,
    recallScorePercent: summaryRow?.recallScorePercent ?? fallbackScore,
  };
}

/**
 * Lists all saved DailyRecallSummaries in reverse chronological order so the user
 * can browse past days and look back at their memories.
 */
export async function getAllRecallSummaries(): Promise<DailyRecallSummary[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    dateString: string;
  }>(
    `SELECT DISTINCT dateString FROM (
       SELECT dateString FROM daily_recall_summaries
       UNION
       SELECT dateString FROM place_visits
     ) ORDER BY dateString DESC`
  );

  const summaries: DailyRecallSummary[] = [];
  for (const row of rows) {
    const summary = await getRecallSummaryByDate(row.dateString);
    if (summary) {
      summaries.push(summary);
    }
  }
  return summaries;
}

/**
 * Clears all rows from raw_locations, place_visits, and daily_recall_summaries
 * and resets autoincrement counters so you can cleanly test adding new recall summaries.
 */
export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM daily_recall_summaries;
    DELETE FROM place_visits;
    DELETE FROM raw_locations;
    DELETE FROM sqlite_sequence WHERE name = 'raw_locations';
  `);
}

/**
 * Clears data for a single dateString (YYYY-MM-DD) across all tables
 * if you want to re-test a specific day without wiping historical days.
 */
export async function clearDataByDate(dateString: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM daily_recall_summaries WHERE dateString = ?`, [dateString]);
  await database.runAsync(`DELETE FROM place_visits WHERE dateString = ?`, [dateString]);
  await database.runAsync(`DELETE FROM raw_locations WHERE dateString = ?`, [dateString]);
}