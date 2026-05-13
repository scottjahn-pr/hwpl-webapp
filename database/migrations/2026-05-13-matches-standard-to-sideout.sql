-- Migration: rename scoring_type value 'Standard' to 'Sideout' for existing rows

BEGIN TRANSACTION;

-- 1. Drop the check constraint that currently blocks non-Standard/Rally values
--    (already updated in code, but the DB constraint still names both old values)
ALTER TABLE dbo.matches DROP CONSTRAINT CHK_matches_scoring_type;

-- 2. Rename existing rows
UPDATE dbo.matches
SET scoring_type = 'Sideout'
WHERE scoring_type = 'Standard';

-- 3. Re-add the constraint with only the new allowed values
ALTER TABLE dbo.matches
ADD CONSTRAINT CHK_matches_scoring_type CHECK (scoring_type IN ('Sideout', 'Rally'));

COMMIT TRANSACTION;
