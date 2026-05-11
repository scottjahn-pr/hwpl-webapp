-- Migration: drop players.email since it is no longer used

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_players_email'
    AND object_id = OBJECT_ID('dbo.players')
)
BEGIN
  DROP INDEX UX_players_email ON dbo.players;
END;

IF COL_LENGTH('dbo.players', 'email') IS NOT NULL
BEGIN
  ALTER TABLE dbo.players DROP COLUMN email;
END;
