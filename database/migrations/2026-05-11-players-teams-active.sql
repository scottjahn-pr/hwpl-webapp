SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.teams', 'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.teams ADD is_active BIT NULL;
END

UPDATE dbo.teams
SET is_active = 1
WHERE is_active IS NULL;

ALTER TABLE dbo.teams ALTER COLUMN is_active BIT NOT NULL;

IF COL_LENGTH('dbo.players', 'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.players ADD is_active BIT NULL;
END

UPDATE dbo.players
SET is_active = 1
WHERE is_active IS NULL;

ALTER TABLE dbo.players ALTER COLUMN is_active BIT NOT NULL;

COMMIT TRANSACTION;
