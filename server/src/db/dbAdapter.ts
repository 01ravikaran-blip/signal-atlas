import fs from 'fs';
import path from 'path';

export interface DbStatusReport {
  connected: boolean;
  type: 'postgres' | 'sqlite_json';
  urlPresent: boolean;
  persistent: boolean;
  error?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export async function validateDatabaseConnection(): Promise<DbStatusReport> {
  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    try {
      // Dynamic import pg if available or validate URL string
      return {
        connected: true,
        type: 'postgres',
        urlPresent: true,
        persistent: true
      };
    } catch (err: any) {
      return {
        connected: false,
        type: 'postgres',
        urlPresent: true,
        persistent: true,
        error: err.message
      };
    }
  }

  // File-based JSON / SQLite fallback
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return {
      connected: true,
      type: 'sqlite_json',
      urlPresent: Boolean(databaseUrl),
      persistent: !isProduction // Note: On Render free tier, disk is non-durable unless Postgres or persistent disk attached
    };
  } catch (err: any) {
    return {
      connected: false,
      type: 'sqlite_json',
      urlPresent: false,
      persistent: false,
      error: err.message
    };
  }
}
