SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.leagues', 'end_date') IS NULL
BEGIN
  ALTER TABLE dbo.leagues ADD end_date DATE NULL;
END

UPDATE dbo.leagues
SET end_date = start_date
WHERE end_date IS NULL;

ALTER TABLE dbo.leagues ALTER COLUMN end_date DATE NOT NULL;

COMMIT TRANSACTION;
