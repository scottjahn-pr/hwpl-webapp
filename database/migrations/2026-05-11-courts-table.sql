-- Migration: add courts lookup table for match venue management

CREATE TABLE dbo.courts (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(120) NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UX_courts_name ON dbo.courts(name);
