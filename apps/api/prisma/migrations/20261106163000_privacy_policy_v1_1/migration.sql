-- Publish Privacy Policy 1.1. Bodies stay in the application.
-- effectiveAt is the stated effective date; publishedAt is when this migration runs.
INSERT INTO "legal_documents" ("id", "type", "version", "locale", "title", "status", "publishedAt", "effectiveAt", "createdAt", "updatedAt")
VALUES
    ('legal_privacy_1_1_ka', 'PRIVACY', '1.1', 'ka', 'კონფიდენციალურობის პოლიტიკა', 'published', CURRENT_TIMESTAMP, '2026-11-05 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('legal_privacy_1_1_en', 'PRIVACY', '1.1', 'en', 'Privacy Policy', 'published', CURRENT_TIMESTAMP, '2026-11-05 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Privacy Policy 1.0 rows were stamped with the 20260920140000 migration's run time, which can be
-- later than 1.1's effectiveAt, so they must leave the published set for 1.1 to be current.
-- Only status changes; version, dates and Terms rows are untouched.
UPDATE "legal_documents"
SET "status" = 'archived'
WHERE "id" IN ('legal_privacy_1_0_ka', 'legal_privacy_1_0_en')
  AND "type" = 'PRIVACY'
  AND "version" = '1.0';
