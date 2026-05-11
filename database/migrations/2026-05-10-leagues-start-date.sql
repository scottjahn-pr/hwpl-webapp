SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.leagues', 'season') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.leagues', 'start_date') IS NULL
  BEGIN
    ALTER TABLE dbo.leagues ADD start_date DATE NULL;

    UPDATE dbo.leagues
    SET start_date = COALESCE(
      TRY_CONVERT(date, season),
      DATEFROMPARTS(
        COALESCE(TRY_CONVERT(int, RIGHT(LTRIM(RTRIM(season)), 4)), YEAR(SYSUTCDATETIME())),
        1,
        1
      )
    );

    ALTER TABLE dbo.leagues ALTER COLUMN start_date DATE NOT NULL;
  END

  ALTER TABLE dbo.leagues DROP COLUMN season;
END

COMMIT TRANSACTION;
