-- Migration: replace teams.league_id (many-to-one) with team_leagues junction table (many-to-many)

-- Step 1: Create the junction table
CREATE TABLE dbo.team_leagues (
  team_id   UNIQUEIDENTIFIER NOT NULL,
  league_id UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT PK_team_leagues PRIMARY KEY (team_id, league_id),
  CONSTRAINT FK_team_leagues_team   FOREIGN KEY (team_id)   REFERENCES dbo.teams(id),
  CONSTRAINT FK_team_leagues_league FOREIGN KEY (league_id) REFERENCES dbo.leagues(id)
);

-- Step 2: Migrate existing team→league relationships into the junction table
INSERT INTO dbo.team_leagues (team_id, league_id)
SELECT id, league_id
FROM dbo.teams
WHERE league_id IS NOT NULL;

-- Step 3: Drop the old FK constraint and column from teams
ALTER TABLE dbo.teams DROP CONSTRAINT FK_teams_league;
ALTER TABLE dbo.teams DROP COLUMN league_id;
