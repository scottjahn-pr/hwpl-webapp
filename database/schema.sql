SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.match_participants', 'U') IS NOT NULL DROP TABLE dbo.match_participants;
IF OBJECT_ID('dbo.matches', 'U') IS NOT NULL DROP TABLE dbo.matches;
IF OBJECT_ID('dbo.players', 'U') IS NOT NULL DROP TABLE dbo.players;
IF OBJECT_ID('dbo.team_leagues', 'U') IS NOT NULL DROP TABLE dbo.team_leagues;
IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL DROP TABLE dbo.teams;
IF OBJECT_ID('dbo.courts', 'U') IS NOT NULL DROP TABLE dbo.courts;
IF OBJECT_ID('dbo.leagues', 'U') IS NOT NULL DROP TABLE dbo.leagues;

CREATE TABLE dbo.leagues (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.teams (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(120) NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.courts (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(120) NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.team_leagues (
  team_id   UNIQUEIDENTIFIER NOT NULL,
  league_id UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT PK_team_leagues PRIMARY KEY (team_id, league_id),
  CONSTRAINT FK_team_leagues_team   FOREIGN KEY (team_id)   REFERENCES dbo.teams(id),
  CONSTRAINT FK_team_leagues_league FOREIGN KEY (league_id) REFERENCES dbo.leagues(id)
);

CREATE TABLE dbo.players (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  first_name NVARCHAR(120) NOT NULL,
  last_name NVARCHAR(120) NOT NULL,
  email NVARCHAR(250) NOT NULL,
  dupr_id NVARCHAR(100) NOT NULL,
  default_team_id UNIQUEIDENTIFIER NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_players_default_team FOREIGN KEY (default_team_id) REFERENCES dbo.teams(id)
);

CREATE TABLE dbo.matches (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  league_id UNIQUEIDENTIFIER NOT NULL,
  match_date DATE NOT NULL,
  team_a_id UNIQUEIDENTIFIER NOT NULL,
  team_b_id UNIQUEIDENTIFIER NOT NULL,
  score_a INT NOT NULL,
  score_b INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CHK_matches_non_tie CHECK (score_a <> score_b),
  CONSTRAINT CHK_matches_distinct_teams CHECK (team_a_id <> team_b_id),
  CONSTRAINT FK_matches_league FOREIGN KEY (league_id) REFERENCES dbo.leagues(id),
  CONSTRAINT FK_matches_team_a FOREIGN KEY (team_a_id) REFERENCES dbo.teams(id),
  CONSTRAINT FK_matches_team_b FOREIGN KEY (team_b_id) REFERENCES dbo.teams(id)
);

CREATE TABLE dbo.match_participants (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  match_id UNIQUEIDENTIFIER NOT NULL,
  player_id UNIQUEIDENTIFIER NOT NULL,
  team_side CHAR(1) NOT NULL,
  team_id UNIQUEIDENTIFIER NOT NULL,
  participant_order TINYINT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CHK_participants_side CHECK (team_side IN ('A', 'B')),
  CONSTRAINT CHK_participant_order CHECK (participant_order IN (1, 2)),
  CONSTRAINT FK_participants_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id) ON DELETE CASCADE,
  CONSTRAINT FK_participants_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
  CONSTRAINT FK_participants_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
);

CREATE UNIQUE INDEX UX_players_email ON dbo.players(email);
CREATE UNIQUE INDEX UX_players_dupr_id ON dbo.players(dupr_id);
CREATE UNIQUE INDEX UX_courts_name ON dbo.courts(name);
CREATE UNIQUE INDEX UX_match_participants_unique_player ON dbo.match_participants(match_id, player_id);
CREATE UNIQUE INDEX UX_match_participants_slot ON dbo.match_participants(match_id, team_side, participant_order);

CREATE INDEX IX_matches_league_date ON dbo.matches(league_id, match_date);
CREATE INDEX IX_match_participants_player ON dbo.match_participants(player_id);
