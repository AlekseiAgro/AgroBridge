import { redactError, redactText } from './redact';

describe('redactText', () => {
  it('strips connection strings and access-key shaped secrets', () => {
    expect(
      redactText('failed postgresql://agrobridge:super-secret@localhost:5432/agrobridge'),
    ).toBe('failed [redacted-database-url]');
    expect(redactText('https://user:hunter2@example.com/path')).toBe('https://user:***@example.com/path');
  });

  it('redacts Error messages down to a single safe line', () => {
    expect(
      redactError(new Error('pg_dump failed\npostgresql://agrobridge:pw@localhost/db')),
    ).toBe('pg_dump failed');
  });
});
