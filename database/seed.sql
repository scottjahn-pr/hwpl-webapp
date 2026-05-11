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

INSERT INTO dbo.teams (id, name, league_id)
VALUES
(@teamRiver, 'River Volleys', @leaguePremier),
(@teamBarrel, 'Barrel Smash', @leaguePremier),
(@teamKitchen, 'Kitchen Kings', @leagueSocial),
(@teamBaseline, 'Baseline Crew', @leagueSocial);

INSERT INTO dbo.players (first_name, last_name, email, dupr_id, default_team_id)
VALUES
('Avery', 'Martin', 'avery@example.com', 'D1001', @teamRiver),
('Jordan', 'Lee', 'jordan@example.com', 'D1002', @teamRiver),
('Casey', 'Nguyen', 'casey@example.com', 'D1003', @teamBarrel),
('Riley', 'Parker', 'riley@example.com', 'D1004', @teamBarrel),
('Blake', 'Thomas', 'blake@example.com', 'D1005', @teamKitchen),
('Morgan', 'Singh', 'morgan@example.com', 'D1006', @teamKitchen),
('Quinn', 'Hall', 'quinn@example.com', 'D1007', @teamBaseline),
('Taylor', 'Brooks', 'taylor@example.com', 'D1008', @teamBaseline);
