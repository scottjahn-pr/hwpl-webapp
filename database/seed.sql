DECLARE @leaguePremier UNIQUEIDENTIFIER = NEWID();
DECLARE @leagueSocial UNIQUEIDENTIFIER = NEWID();
DECLARE @teamRiver UNIQUEIDENTIFIER = NEWID();
DECLARE @teamBarrel UNIQUEIDENTIFIER = NEWID();
DECLARE @teamKitchen UNIQUEIDENTIFIER = NEWID();
DECLARE @teamBaseline UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.leagues (id, name, start_date, end_date, is_active)
VALUES
(@leaguePremier, 'HWPL Premier', '2026-03-01', '2026-06-30', 1),
(@leagueSocial, 'HWPL Social', '2026-03-01', '2026-06-30', 1);

INSERT INTO dbo.teams (id, name, is_active)
VALUES
(@teamRiver, 'River Volleys', 1),
(@teamBarrel, 'Barrel Smash', 1),
(@teamKitchen, 'Kitchen Kings', 1),
(@teamBaseline, 'Baseline Crew', 1);

INSERT INTO dbo.team_leagues (team_id, league_id)
VALUES
(@teamRiver,    @leaguePremier),
(@teamBarrel,   @leaguePremier),
(@teamKitchen,  @leagueSocial),
(@teamBaseline, @leagueSocial);

INSERT INTO dbo.courts (name, is_active)
VALUES
('Court 1', 1),
('Court 2', 1),
('Court 3', 1);

INSERT INTO dbo.players (first_name, last_name, dupr_id, default_team_id, is_active)
VALUES
('Avery', 'Martin', 'D1001', @teamRiver, 1),
('Jordan', 'Lee', 'D1002', @teamRiver, 1),
('Casey', 'Nguyen', 'D1003', @teamBarrel, 1),
('Riley', 'Parker', 'D1004', @teamBarrel, 1),
('Blake', 'Thomas', 'D1005', @teamKitchen, 1),
('Morgan', 'Singh', 'D1006', @teamKitchen, 1),
('Quinn', 'Hall', 'D1007', @teamBaseline, 1),
('Taylor', 'Brooks', 'D1008', @teamBaseline, 1);
