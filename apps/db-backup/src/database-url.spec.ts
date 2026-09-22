import { libpqEnvForSpawn, normalizeDatabaseUrl } from './database-url';

describe('normalizeDatabaseUrl', () => {
  it('removes only the Prisma schema query parameter', () => {
    const result = normalizeDatabaseUrl(
      'postgresql://agrobridge:s3cret@db.example:5432/agrobridge?schema=public&sslmode=require',
    );
    expect(result.libpqEnv).toEqual({
      PGHOST: 'db.example',
      PGPORT: '5432',
      PGUSER: 'agrobridge',
      PGPASSWORD: 's3cret',
      PGDATABASE: 'agrobridge',
      PGSSLMODE: 'require',
    });
    expect(result.connectionUrl).not.toContain('schema=');
    expect(result.connectionUrl).toContain('sslmode=require');
  });

  it('keeps postgres:// and default port', () => {
    const result = normalizeDatabaseUrl('postgres://user@localhost/app');
    expect(result.libpqEnv.PGPORT).toBe('5432');
    expect(result.libpqEnv.PGHOST).toBe('localhost');
    expect(result.libpqEnv.PGDATABASE).toBe('app');
    expect(result.libpqEnv.PGPASSWORD).toBe('');
  });

  it('decodes percent-encoded credentials', () => {
    const result = normalizeDatabaseUrl('postgresql://u%40id:p%40ss@localhost:5433/db');
    expect(result.libpqEnv.PGUSER).toBe('u@id');
    expect(result.libpqEnv.PGPASSWORD).toBe('p@ss');
    expect(result.libpqEnv.PGPORT).toBe('5433');
  });

  it('rejects non-postgres URLs', () => {
    expect(() => normalizeDatabaseUrl('mysql://localhost/db')).toThrow(/postgresql scheme/);
  });

  it('rejects missing host or database', () => {
    expect(() => normalizeDatabaseUrl('postgresql://localhost')).toThrow(/host and database/);
  });

  it('does not put DATABASE_URL into the spawn environment', () => {
    const { libpqEnv } = normalizeDatabaseUrl('postgresql://u:p@localhost/db');
    const env = libpqEnvForSpawn(libpqEnv, { DATABASE_URL: 'postgresql://u:p@localhost/db' });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PGPASSWORD).toBe('p');
  });
});
