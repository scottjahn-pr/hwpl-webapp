-- Migration: add court, scoring_type, game_type, and ladder support for matches

ALTER TABLE dbo.matches DROP CONSTRAINT FK_matches_team_a;
ALTER TABLE dbo.matches DROP CONSTRAINT FK_matches_team_b;
ALTER TABLE dbo.matches DROP CONSTRAINT CHK_matches_distinct_teams;
ALTER TABLE dbo.match_participants DROP CONSTRAINT FK_participants_team;

ALTER TABLE dbo.matches ALTER COLUMN team_a_id UNIQUEIDENTIFIER NULL;
ALTER TABLE dbo.matches ALTER COLUMN team_b_id UNIQUEIDENTIFIER NULL;
ALTER TABLE dbo.match_participants ALTER COLUMN team_id UNIQUEIDENTIFIER NULL;

ALTER TABLE dbo.matches
ADD court_id UNIQUEIDENTIFIER NULL;

ALTER TABLE dbo.matches
ADD scoring_type NVARCHAR(20) NOT NULL CONSTRAINT DF_matches_scoring_type DEFAULT 'Sideout' WITH VALUES;

ALTER TABLE dbo.matches
ADD game_type NVARCHAR(20) NOT NULL CONSTRAINT DF_matches_game_type DEFAULT 'Doubles' WITH VALUES;

ALTER TABLE dbo.matches
ADD CONSTRAINT FK_matches_court FOREIGN KEY (court_id) REFERENCES dbo.courts(id);

ALTER TABLE dbo.matches
ADD CONSTRAINT FK_matches_team_a FOREIGN KEY (team_a_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.matches
ADD CONSTRAINT FK_matches_team_b FOREIGN KEY (team_b_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.match_participants
ADD CONSTRAINT FK_participants_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.matches
ADD CONSTRAINT CHK_matches_scoring_type CHECK (scoring_type IN ('Sideout', 'Rally'));

ALTER TABLE dbo.matches
ADD CONSTRAINT CHK_matches_game_type CHECK (game_type IN ('Doubles', 'Ladder'));

ALTER TABLE dbo.matches
ADD CONSTRAINT CHK_matches_teams_for_game_type CHECK (
  (game_type = 'Doubles' AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL AND team_a_id <> team_b_id)
  OR
  (game_type = 'Ladder' AND team_a_id IS NULL AND team_b_id IS NULL)
);

CREATE INDEX IX_matches_court_date ON dbo.matches(court_id, match_date);
