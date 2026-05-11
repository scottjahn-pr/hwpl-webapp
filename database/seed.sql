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

INSERT INTO dbo.teams (id, name, league_id, is_active)
VALUES
(@teamRiver, 'River Volleys', @leaguePremier, 1),
(@teamBarrel, 'Barrel Smash', @leaguePremier, 1),
(@teamKitchen, 'Kitchen Kings', @leagueSocial, 1),
(@teamBaseline, 'Baseline Crew', @leagueSocial, 1);

INSERT INTO dbo.players (first_name, last_name, email, dupr_id, default_team_id, is_active)
VALUES
('Avery', 'Martin', 'avery@example.com', 'D1001', @teamRiver, 1),
('Jordan', 'Lee', 'jordan@example.com', 'D1002', @teamRiver, 1),
('Casey', 'Nguyen', 'casey@example.com', 'D1003', @teamBarrel, 1),
('Riley', 'Parker', 'riley@example.com', 'D1004', @teamBarrel, 1),
('Blake', 'Thomas', 'blake@example.com', 'D1005', @teamKitchen, 1),
('Morgan', 'Singh', 'morgan@example.com', 'D1006', @teamKitchen, 1),
('Quinn', 'Hall', 'quinn@example.com', 'D1007', @teamBaseline, 1),
('Taylor', 'Brooks', 'taylor@example.com', 'D1008', @teamBaseline, 1);
