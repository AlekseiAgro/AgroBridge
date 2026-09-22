import type { LibpqEnv } from './types';
import { BackupError } from './types';

const PRISMA_ONLY_QUERY_PARAMS = new Set(['schema']);
const LIBPQ_SSL_PARAMS = {
  sslmode: 'PGSSLMODE',
  sslrootcert: 'PGSSLROOTCERT',
  sslcert: 'PGSSLCERT',
  sslkey: 'PGSSLKEY',
  sslcrl: 'PGSSLCRL',
} as const;

export type NormalizedDatabaseUrl = {
  libpqEnv: LibpqEnv;
  /** URL without Prisma-only params; password still present — do not log. */
  connectionUrl: string;
};

function decodeComponent(value: string): string {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeDatabaseUrl(raw: string): NormalizedDatabaseUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new BackupError('config', 'DATABASE_URL is required');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BackupError('config', 'DATABASE_URL is not a valid URL');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new BackupError('config', 'DATABASE_URL must use the postgresql scheme');
  }

  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (PRISMA_ONLY_QUERY_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  url.search = params.toString();

  const database = decodeComponent(url.pathname.replace(/^\/+/, '')).split('/')[0] ?? '';
  if (!url.hostname || !database) {
    throw new BackupError('config', 'DATABASE_URL must include a host and database name');
  }

  const libpqEnv: LibpqEnv = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeComponent(url.username),
    PGPASSWORD: decodeComponent(url.password),
    PGDATABASE: database,
  };

  for (const [queryKey, envKey] of Object.entries(LIBPQ_SSL_PARAMS)) {
    const value = params.get(queryKey);
    if (value) {
      libpqEnv[envKey] = value;
    }
  }

  return {
    libpqEnv,
    connectionUrl: url.toString(),
  };
}

export function libpqEnvForSpawn(
  libpqEnv: LibpqEnv,
  extra: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...extra };
  env.PGHOST = libpqEnv.PGHOST;
  env.PGPORT = libpqEnv.PGPORT;
  env.PGUSER = libpqEnv.PGUSER;
  env.PGPASSWORD = libpqEnv.PGPASSWORD;
  env.PGDATABASE = libpqEnv.PGDATABASE;
  if (libpqEnv.PGSSLMODE) env.PGSSLMODE = libpqEnv.PGSSLMODE;
  if (libpqEnv.PGSSLROOTCERT) env.PGSSLROOTCERT = libpqEnv.PGSSLROOTCERT;
  if (libpqEnv.PGSSLCERT) env.PGSSLCERT = libpqEnv.PGSSLCERT;
  if (libpqEnv.PGSSLKEY) env.PGSSLKEY = libpqEnv.PGSSLKEY;
  if (libpqEnv.PGSSLCRL) env.PGSSLCRL = libpqEnv.PGSSLCRL;
  delete env.DATABASE_URL;
  return env;
}
