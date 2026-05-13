import { app } from "@azure/functions";
import { getPrincipalDetails, getPrincipalObjectId, isAdmin, isAuthenticated } from "../lib/auth.js";
import { toCsv } from "../lib/csv.js";
import { getPool, runQuery, sql } from "../lib/db.js";
import { badRequest, json, parseJson, serverError, unauthorized, csv } from "../lib/http.js";

const requireAdmin = (request) => {
  if (!isAuthenticated(request)) {
    return json({ error: "Authentication required." }, 401);
  }

  return isAdmin(request) ? null : unauthorized();
};

const createTraceId = () => `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const apiDiagnosticsVersion = "2026-05-12-team-debug-v1";

const getRouteId = (request, context) => {
  const idFromContext = context?.bindingData?.id;
  const idFromParamsObject = request?.params && typeof request.params === "object"
    ? request.params.id
    : undefined;
  const idFromParamsMap = request?.params && typeof request.params.get === "function"
    ? request.params.get("id")
    : undefined;

  return idFromContext || idFromParamsObject || idFromParamsMap || null;
};

app.http("adminDiagnostics", {
  methods: ["GET"],
  route: "ops/diagnostics",
  handler: async (request) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    return json({ version: apiDiagnosticsVersion, timestamp: new Date().toISOString() });
  }
});

app.http("health", {
  methods: ["GET"],
  route: "health",
  handler: async () => json({ ok: true, service: "hwpl-api" })
});

app.http("debugAuth", {
  methods: ["GET"],
  route: "debug/auth",
  handler: async (request) => {
    const principal = getPrincipalDetails(request);

    return json({
      isAuthenticated: principal.isAuthenticated,
      isAdmin: isAdmin(request),
      objectId: principal.objectId,
      candidateIds: principal.candidateIds,
      principalName: principal.principalName,
      roles: principal.roles,
      headerPresence: {
        hasClientPrincipal: Boolean(request.headers.get("x-ms-client-principal")),
        hasClientPrincipalId: Boolean(request.headers.get("x-ms-client-principal-id")),
        hasClientPrincipalName: Boolean(request.headers.get("x-ms-client-principal-name"))
      }
    });
  }
});

app.http("adminMe", {
  methods: ["GET"],
  route: "ops/me",
  handler: async (request) => {
    const principal = getPrincipalDetails(request);

    if (!principal.isAuthenticated) {
      return json({ isAdmin: false, error: "Authentication required." }, 401);
    }

    if (!isAdmin(request)) {
      return json(
        {
          isAdmin: false,
          error: "Admin role required.",
          objectId: principal.objectId,
          candidateIds: principal.candidateIds,
          principalName: principal.principalName
        },
        403
      );
    }

    return json({ isAdmin: true, objectId: getPrincipalObjectId(request), candidateIds: principal.candidateIds });
  }
});

app.http("statsMatches", {
  methods: ["GET"],
  route: "stats/matches",
  handler: async () => {
    try {
      const result = await runQuery(`
        WITH ladder_side_names AS (
          SELECT
            m.id AS match_id,
            mp.team_side,
            STUFF((
              SELECT ' & ' + p2.first_name
              FROM match_participants mp2
              JOIN players p2 ON p2.id = mp2.player_id
              WHERE mp2.match_id = m.id AND mp2.team_side = mp.team_side
              ORDER BY mp2.participant_order
              FOR XML PATH(''), TYPE
            ).value('.', 'nvarchar(max)'), 1, 3, '') AS side_name
          FROM matches m
          JOIN match_participants mp ON mp.match_id = m.id
          WHERE m.game_type = 'Ladder'
          GROUP BY m.id, mp.team_side
        )
        SELECT TOP 10
          m.id,
          CONVERT(varchar(10), m.match_date, 120) AS date,
          CASE
            WHEN m.game_type = 'Ladder' THEN COALESCE(lsa.side_name, 'Ladder Side A')
            ELSE COALESCE(ta.name, 'Ladder Side A')
          END AS teamA,
          CASE
            WHEN m.game_type = 'Ladder' THEN COALESCE(lsb.side_name, 'Ladder Side B')
            ELSE COALESCE(tb.name, 'Ladder Side B')
          END AS teamB,
          m.score_a AS scoreA,
          m.score_b AS scoreB
        FROM matches m
        LEFT JOIN teams ta ON ta.id = m.team_a_id
        LEFT JOIN teams tb ON tb.id = m.team_b_id
        LEFT JOIN ladder_side_names lsa ON lsa.match_id = m.id AND lsa.team_side = 'A'
        LEFT JOIN ladder_side_names lsb ON lsb.match_id = m.id AND lsb.team_side = 'B'
        ORDER BY m.match_date DESC, m.created_at DESC;
      `);
      return json(result.recordset);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsMatchesFull", {
  methods: ["GET"],
  route: "stats/matches-full",
  handler: async () => {
    try {
      const result = await runQuery(`
        WITH ladder_side_names AS (
          SELECT
            m.id AS match_id,
            mp.team_side,
            STUFF((
              SELECT ' & ' + p2.first_name
              FROM match_participants mp2
              JOIN players p2 ON p2.id = mp2.player_id
              WHERE mp2.match_id = m.id AND mp2.team_side = mp.team_side
              ORDER BY mp2.participant_order
              FOR XML PATH(''), TYPE
            ).value('.', 'nvarchar(max)'), 1, 3, '') AS side_name
          FROM matches m
          JOIN match_participants mp ON mp.match_id = m.id
          WHERE m.game_type = 'Ladder'
          GROUP BY m.id, mp.team_side
        )
        SELECT
          m.id,
          CONVERT(varchar(10), m.match_date, 120) AS date,
          m.league_id AS leagueId,
          l.name AS leagueName,
          CONVERT(varchar(10), l.start_date, 120) AS leagueStartDate,
          CONVERT(varchar(10), l.end_date, 120) AS leagueEndDate,
          m.court_id AS courtId,
          COALESCE(c.name, 'Unassigned Court') AS courtName,
          m.scoring_type AS scoringType,
          m.game_type AS gameType,
          m.team_a_id AS teamAId,
          m.team_b_id AS teamBId,
          CASE
            WHEN m.game_type = 'Ladder' THEN COALESCE(lsa.side_name, 'Ladder Side A')
            ELSE COALESCE(ta.name, 'Ladder Side A')
          END AS teamAName,
          CASE
            WHEN m.game_type = 'Ladder' THEN COALESCE(lsb.side_name, 'Ladder Side B')
            ELSE COALESCE(tb.name, 'Ladder Side B')
          END AS teamBName,
          m.score_a AS scoreA,
          m.score_b AS scoreB,
          mp.player_id AS playerId,
          p.first_name + ' ' + p.last_name AS playerName,
          mp.team_side AS teamSide,
          mp.participant_order AS participantOrder,
          mp.team_id AS participantTeamId
        FROM matches m
        JOIN leagues l ON l.id = m.league_id
        LEFT JOIN courts c ON c.id = m.court_id
        LEFT JOIN teams ta ON ta.id = m.team_a_id
        LEFT JOIN teams tb ON tb.id = m.team_b_id
        LEFT JOIN ladder_side_names lsa ON lsa.match_id = m.id AND lsa.team_side = 'A'
        LEFT JOIN ladder_side_names lsb ON lsb.match_id = m.id AND lsb.team_side = 'B'
        LEFT JOIN match_participants mp ON mp.match_id = m.id
        LEFT JOIN players p ON p.id = mp.player_id
        ORDER BY m.match_date DESC, m.created_at DESC, mp.team_side, mp.participant_order;
      `);

      const matchesById = new Map();

      for (const row of result.recordset) {
        if (!matchesById.has(row.id)) {
          matchesById.set(row.id, {
            id: row.id,
            date: row.date,
            leagueId: row.leagueId,
            leagueName: row.leagueName,
            leagueStartDate: row.leagueStartDate,
            leagueEndDate: row.leagueEndDate,
            courtId: row.courtId,
            courtName: row.courtName,
            scoringType: row.scoringType,
            gameType: row.gameType,
            teamAId: row.teamAId,
            teamBId: row.teamBId,
            teamAName: row.teamAName,
            teamBName: row.teamBName,
            scoreA: row.scoreA,
            scoreB: row.scoreB,
            participants: []
          });
        }

        if (row.playerId) {
          matchesById.get(row.id).participants.push({
            playerId: row.playerId,
            playerName: row.playerName,
            teamSide: row.teamSide,
            participantOrder: row.participantOrder,
            teamId: row.participantTeamId
          });
        }
      }

      return json(Array.from(matchesById.values()));
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsPlayers", {
  methods: ["GET"],
  route: "stats/players",
  handler: async () => {
    try {
      const result = await runQuery(`
        WITH player_games AS (
          SELECT
            p.id,
            p.first_name + ' ' + p.last_name AS name,
            COUNT(mp.id) AS games_played,
            SUM(CASE WHEN (mp.team_side = 'A' AND m.score_a > m.score_b) OR (mp.team_side = 'B' AND m.score_b > m.score_a) THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN mp.team_side = 'A' THEN m.score_a ELSE m.score_b END) AS points_for,
            SUM(CASE WHEN mp.team_side = 'A' THEN m.score_b ELSE m.score_a END) AS points_against
          FROM players p
          LEFT JOIN match_participants mp ON mp.player_id = p.id
          LEFT JOIN matches m ON m.id = mp.match_id
          GROUP BY p.id, p.first_name, p.last_name
        )
        SELECT
          id,
          name,
          games_played AS gamesPlayed,
          wins,
          (games_played - wins) AS losses,
          points_for AS pointsFor,
          points_against AS pointsAgainst,
          (points_for - points_against) AS differential,
          CASE WHEN games_played = 0 THEN 0 ELSE CAST(wins AS float) / games_played END AS winRate
        FROM player_games
        ORDER BY wins DESC, winRate DESC, differential DESC;
      `);

      return json(result.recordset);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsTeams", {
  methods: ["GET"],
  route: "stats/teams",
  handler: async () => {
    try {
      const result = await runQuery(`
        WITH all_games AS (
          SELECT team_a_id AS team_id, score_a AS points_for, score_b AS points_against,
            CASE WHEN score_a > score_b THEN 1 ELSE 0 END AS win
          FROM matches
          WHERE game_type = 'Doubles' AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
          UNION ALL
          SELECT team_b_id AS team_id, score_b AS points_for, score_a AS points_against,
            CASE WHEN score_b > score_a THEN 1 ELSE 0 END AS win
          FROM matches
          WHERE game_type = 'Doubles' AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
        )
        SELECT
          t.id,
          t.name,
          COUNT(g.team_id) AS gamesPlayed,
          SUM(ISNULL(g.win, 0)) AS wins,
          COUNT(g.team_id) - SUM(ISNULL(g.win, 0)) AS losses,
          SUM(ISNULL(g.points_for, 0)) AS pointsFor,
          SUM(ISNULL(g.points_against, 0)) AS pointsAgainst,
          SUM(ISNULL(g.points_for, 0)) - SUM(ISNULL(g.points_against, 0)) AS differential,
          CASE WHEN COUNT(g.team_id) = 0 THEN 0 ELSE CAST(SUM(ISNULL(g.win, 0)) AS float) / COUNT(g.team_id) END AS winRate
        FROM teams t
        LEFT JOIN all_games g ON g.team_id = t.id
        GROUP BY t.id, t.name
        ORDER BY wins DESC, winRate DESC, differential DESC;
      `);

      return json(result.recordset);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsLeagues", {
  methods: ["GET"],
  route: "stats/leagues",
  handler: async () => {
    try {
      const result = await runQuery(`
        SELECT
          l.id,
          l.name,
          CONVERT(varchar(10), l.start_date, 120) AS startDate,
          CONVERT(varchar(10), l.end_date, 120) AS endDate,
          l.is_active AS isActive,
          COUNT(m.id) AS matches,
          CASE WHEN COUNT(m.id) = 0 THEN 0 ELSE CAST(SUM(m.score_a + m.score_b) AS float) / COUNT(m.id) END AS avgPointsPerMatch
        FROM leagues l
        LEFT JOIN matches m ON m.league_id = l.id
        GROUP BY l.id, l.name, l.start_date, l.end_date, l.is_active
        ORDER BY l.start_date DESC, l.name;
      `);

      return json(result.recordset);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsSessionDates", {
  methods: ["GET"],
  route: "stats/session-dates",
  handler: async () => {
    try {
      const result = await runQuery(`
        SELECT DISTINCT CONVERT(varchar(10), match_date, 120) AS sessionDate
        FROM matches
        ORDER BY sessionDate DESC;
      `);
      return json(result.recordset.map(r => r.sessionDate));
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("statsSession", {
  methods: ["GET"],
  route: "stats/session",
  handler: async (request) => {
    try {
      const date = new URL(request.url).searchParams.get("date");
      if (!date) return badRequest("Missing query param: date");

      const doublesResult = await runQuery(`
        WITH match_teams AS (
          SELECT c.id AS court_id, c.name AS court_name,
            m.team_a_id AS team_id, ta.name AS team_name,
            m.score_a AS pf, m.score_b AS pa,
            CASE WHEN m.score_a > m.score_b THEN 1 ELSE 0 END AS win
          FROM matches m
          JOIN courts c ON c.id = m.court_id
          JOIN teams ta ON ta.id = m.team_a_id
          WHERE m.game_type = 'Doubles'
            AND CONVERT(varchar(10), m.match_date, 120) = @date
            AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
          UNION ALL
          SELECT c.id, c.name,
            m.team_b_id, tb.name,
            m.score_b, m.score_a,
            CASE WHEN m.score_b > m.score_a THEN 1 ELSE 0 END
          FROM matches m
          JOIN courts c ON c.id = m.court_id
          JOIN teams tb ON tb.id = m.team_b_id
          WHERE m.game_type = 'Doubles'
            AND CONVERT(varchar(10), m.match_date, 120) = @date
            AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
        )
        SELECT court_id AS courtId, court_name AS courtName,
          team_id AS teamId, team_name AS teamName,
          COUNT(*) AS gamesPlayed,
          SUM(win) AS wins,
          COUNT(*) - SUM(win) AS losses,
          SUM(pf) AS pointsFor,
          SUM(pa) AS pointsAgainst,
          SUM(pf) - SUM(pa) AS differential,
          CASE WHEN COUNT(*) = 0 THEN 0 ELSE CAST(SUM(win) AS float) / COUNT(*) END AS winRate
        FROM match_teams
        GROUP BY court_id, court_name, team_id, team_name
        ORDER BY court_name, wins DESC, winRate DESC;
      `, [{ name: "date", type: sql.NVarChar(10), value: date }]);

      const ladderResult = await runQuery(`
        WITH player_games AS (
          SELECT c.id AS court_id, c.name AS court_name,
            p.id AS player_id,
            p.first_name + ' ' + p.last_name AS player_name,
            CASE WHEN (mp.team_side = 'A' AND m.score_a > m.score_b) OR (mp.team_side = 'B' AND m.score_b > m.score_a) THEN 1 ELSE 0 END AS win,
            CASE WHEN mp.team_side = 'A' THEN m.score_a ELSE m.score_b END AS pf,
            CASE WHEN mp.team_side = 'A' THEN m.score_b ELSE m.score_a END AS pa
          FROM matches m
          JOIN courts c ON c.id = m.court_id
          JOIN match_participants mp ON mp.match_id = m.id
          JOIN players p ON p.id = mp.player_id
          WHERE m.game_type = 'Ladder'
            AND CONVERT(varchar(10), m.match_date, 120) = @date
        )
        SELECT court_id AS courtId, court_name AS courtName,
          player_id AS playerId, player_name AS playerName,
          COUNT(*) AS gamesPlayed,
          SUM(win) AS wins,
          COUNT(*) - SUM(win) AS losses,
          SUM(pf) AS pointsFor,
          SUM(pa) AS pointsAgainst,
          SUM(pf) - SUM(pa) AS differential,
          CASE WHEN COUNT(*) = 0 THEN 0 ELSE CAST(SUM(win) AS float) / COUNT(*) END AS winRate
        FROM player_games
        GROUP BY court_id, court_name, player_id, player_name
        ORDER BY court_name, wins DESC, winRate DESC;
      `, [{ name: "date", type: sql.NVarChar(10), value: date }]);

      const courtsMap = new Map();

      for (const row of doublesResult.recordset) {
        if (!courtsMap.has(row.courtId)) {
          courtsMap.set(row.courtId, { courtId: row.courtId, courtName: row.courtName, doubles: [], ladder: [] });
        }
        courtsMap.get(row.courtId).doubles.push({
          teamId: row.teamId, teamName: row.teamName,
          gamesPlayed: row.gamesPlayed, wins: row.wins, losses: row.losses,
          pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
          differential: row.differential, winRate: row.winRate
        });
      }

      for (const row of ladderResult.recordset) {
        if (!courtsMap.has(row.courtId)) {
          courtsMap.set(row.courtId, { courtId: row.courtId, courtName: row.courtName, doubles: [], ladder: [] });
        }
        courtsMap.get(row.courtId).ladder.push({
          playerId: row.playerId, playerName: row.playerName,
          gamesPlayed: row.gamesPlayed, wins: row.wins, losses: row.losses,
          pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
          differential: row.differential, winRate: row.winRate
        });
      }

      const courts = [...courtsMap.values()].sort((a, b) => a.courtName.localeCompare(b.courtName));
      return json(courts);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

const handleAdminPlayers = async (request, id) => {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    if (request.method === "GET") {
      const result = await runQuery(`
        SELECT id, first_name AS firstName, last_name AS lastName, dupr_id AS duprId, default_team_id AS defaultTeamId, is_active AS isActive
        FROM players
        ORDER BY first_name, last_name;
      `);
      return json(result.recordset);
    }

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");

    if (request.method === "POST") {
      const result = await runQuery(
        `
        INSERT INTO players (first_name, last_name, dupr_id, default_team_id, is_active)
        OUTPUT INSERTED.id
        VALUES (@firstName, @lastName, @duprId, @defaultTeamId, @isActive);
        `,
        [
          { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
          { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
          { name: "duprId", type: sql.NVarChar(100), value: payload.duprId },
          { name: "defaultTeamId", type: sql.UniqueIdentifier, value: payload.defaultTeamId || null },
          { name: "isActive", type: sql.Bit, value: payload.isActive ?? true }
        ]
      );
      return json({ id: result.recordset[0].id }, 201);
    }

    if (!id) return badRequest("Missing route parameter: id.");

    if (request.method === "PUT") {
      await runQuery(
        `
        UPDATE players
        SET first_name = @firstName,
            last_name = @lastName,
            dupr_id = @duprId,
            default_team_id = @defaultTeamId,
            is_active = @isActive
        WHERE id = @id;
        `,
        [
          { name: "id", type: sql.UniqueIdentifier, value: id },
          { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
          { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
          { name: "duprId", type: sql.NVarChar(100), value: payload.duprId },
          { name: "defaultTeamId", type: sql.UniqueIdentifier, value: payload.defaultTeamId || null },
          { name: "isActive", type: sql.Bit, value: payload.isActive ?? true }
        ]
      );
      return json({ updated: true });
    }

    await runQuery("UPDATE players SET is_active = 0 WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
    return json({ deactivated: true });
  } catch (error) {
    return serverError(error.message);
  }
};

const handleAdminTeams = async (request, id) => {
  const authError = requireAdmin(request);
  if (authError) return authError;

  let payloadForDebug = null;

  try {
    if (request.method === "GET") {
      const result = await runQuery(`
        SELECT t.id, t.name, t.is_active AS isActive,
               STRING_AGG(CAST(tl.league_id AS NVARCHAR(36)), ',') AS leagueIds
        FROM teams t
        LEFT JOIN team_leagues tl ON tl.team_id = t.id
        GROUP BY t.id, t.name, t.is_active
        ORDER BY t.name;
      `);
      return json(result.recordset.map((r) => ({
        id: r.id,
        name: r.name,
        isActive: Boolean(r.isActive),
        leagueIds: r.leagueIds ? r.leagueIds.split(",") : []
      })));
    }

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");
    payloadForDebug = payload;

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    if (request.method === "POST") {
      try {
        await tx.begin();
        const teamReq = new sql.Request(tx);
        teamReq.input("name", sql.NVarChar(120), payload.name);
        teamReq.input("isActive", sql.Bit, payload.isActive ?? true);
        const teamResult = await teamReq.query("INSERT INTO teams (name, is_active) OUTPUT INSERTED.id VALUES (@name, @isActive);");
        const teamId = teamResult.recordset[0].id;
        for (const leagueId of (payload.leagueIds ?? [])) {
          const tlReq = new sql.Request(tx);
          tlReq.input("teamId", sql.UniqueIdentifier, teamId);
          tlReq.input("leagueId", sql.UniqueIdentifier, leagueId);
          await tlReq.query("INSERT INTO team_leagues (team_id, league_id) VALUES (@teamId, @leagueId);");
        }
        await tx.commit();
        return json({ id: teamId }, 201);
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          // Ignore rollback failure so we can return the original error details.
        }
        throw error;
      }
    }

    if (!id) return badRequest("Missing route parameter: id.");

    if (request.method === "PUT") {
      try {
        await tx.begin();
        const teamReq = new sql.Request(tx);
        teamReq.input("id", sql.UniqueIdentifier, id);
        teamReq.input("name", sql.NVarChar(120), payload.name);
        teamReq.input("isActive", sql.Bit, payload.isActive ?? true);
        await teamReq.query("UPDATE teams SET name = @name, is_active = @isActive WHERE id = @id;");
        if (Array.isArray(payload.leagueIds)) {
          const deleteReq = new sql.Request(tx);
          deleteReq.input("teamId", sql.UniqueIdentifier, id);
          await deleteReq.query("DELETE FROM team_leagues WHERE team_id = @teamId;");
          for (const leagueId of payload.leagueIds) {
            const tlReq = new sql.Request(tx);
            tlReq.input("teamId", sql.UniqueIdentifier, id);
            tlReq.input("leagueId", sql.UniqueIdentifier, leagueId);
            await tlReq.query("INSERT INTO team_leagues (team_id, league_id) VALUES (@teamId, @leagueId);");
          }
        }
        await tx.commit();
        return json({ updated: true });
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          // Ignore rollback failure so we can return the original error details.
        }
        throw error;
      }
    }

    await runQuery("UPDATE teams SET is_active = 0 WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
    return json({ deactivated: true });
  } catch (error) {
    const traceId = createTraceId();
    const message = error instanceof Error ? error.message : String(error);
    const sqlError = (typeof error === "object" && error !== null) ? error : {};

    console.error("handleAdminTeams failed", {
      traceId,
      id,
      method: request.method,
      url: request.url,
      message,
      code: sqlError.code,
      number: sqlError.number,
      state: sqlError.state,
      class: sqlError.class,
      lineNumber: sqlError.lineNumber,
      payload: payloadForDebug
    });

    return json(
      {
        error: message,
        message,
        traceId,
        debug: {
          id,
          method: request.method,
          url: request.url,
          payload: payloadForDebug,
          sql: {
            code: sqlError.code ?? null,
            number: sqlError.number ?? null,
            state: sqlError.state ?? null,
            class: sqlError.class ?? null,
            lineNumber: sqlError.lineNumber ?? null
          }
        }
      },
      409
    );
  }
};

const handleAdminLeagues = async (request, id) => {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    if (request.method === "GET") {
      const result = await runQuery("SELECT id, name, CONVERT(varchar(10), start_date, 120) AS startDate, CONVERT(varchar(10), end_date, 120) AS endDate, is_active AS isActive FROM leagues ORDER BY start_date DESC, name;");
      return json(result.recordset);
    }

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");
    if (!payload.startDate) return badRequest("Field 'startDate' is required.");
    if (!payload.endDate) return badRequest("Field 'endDate' is required.");
    if (payload.endDate < payload.startDate) return badRequest("Field 'endDate' cannot be earlier than 'startDate'.");

    if (request.method === "POST") {
      const result = await runQuery(
        "INSERT INTO leagues (name, start_date, end_date, is_active) OUTPUT INSERTED.id VALUES (@name, @startDate, @endDate, @isActive);",
        [
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "startDate", type: sql.Date, value: payload.startDate },
          { name: "endDate", type: sql.Date, value: payload.endDate },
          { name: "isActive", type: sql.Bit, value: Boolean(payload.isActive) }
        ]
      );
      return json({ id: result.recordset[0].id }, 201);
    }

    if (!id) return badRequest("Missing route parameter: id.");

    if (request.method === "PUT") {
      await runQuery(
        "UPDATE leagues SET name = @name, start_date = @startDate, end_date = @endDate, is_active = @isActive WHERE id = @id;",
        [
          { name: "id", type: sql.UniqueIdentifier, value: id },
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "startDate", type: sql.Date, value: payload.startDate },
          { name: "endDate", type: sql.Date, value: payload.endDate },
          { name: "isActive", type: sql.Bit, value: Boolean(payload.isActive) }
        ]
      );
      return json({ updated: true });
    }

    await runQuery("UPDATE leagues SET is_active = 0 WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
    return json({ deactivated: true });
  } catch (error) {
    return serverError(error.message);
  }
};

const handleAdminCourts = async (request, id) => {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    if (request.method === "GET") {
      const result = await runQuery("SELECT id, name, is_active AS isActive FROM courts ORDER BY name;");
      return json(result.recordset);
    }

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");

    if (request.method === "POST") {
      const result = await runQuery(
        "INSERT INTO courts (name, is_active) OUTPUT INSERTED.id VALUES (@name, @isActive);",
        [
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "isActive", type: sql.Bit, value: payload.isActive ?? true }
        ]
      );
      return json({ id: result.recordset[0].id }, 201);
    }

    if (!id) return badRequest("Missing route parameter: id.");

    if (request.method === "PUT") {
      await runQuery(
        "UPDATE courts SET name = @name, is_active = @isActive WHERE id = @id;",
        [
          { name: "id", type: sql.UniqueIdentifier, value: id },
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "isActive", type: sql.Bit, value: Boolean(payload.isActive) }
        ]
      );
      return json({ updated: true });
    }

    await runQuery("UPDATE courts SET is_active = 0 WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
    return json({ deactivated: true });
  } catch (error) {
    return serverError(error.message);
  }
};

app.http("adminPlayersCollection", {
  methods: ["GET", "POST"],
  route: "ops/players",
  handler: async (request) => handleAdminPlayers(request)
});

app.http("adminPlayersItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/players/{id}",
  handler: async (request, context) => handleAdminPlayers(request, getRouteId(request, context))
});

app.http("adminTeamsCollection", {
  methods: ["GET", "POST"],
  route: "ops/teams",
  handler: async (request) => handleAdminTeams(request)
});

app.http("adminTeamsItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/teams/{id}",
  handler: async (request, context) => handleAdminTeams(request, getRouteId(request, context))
});

app.http("adminLeaguesCollection", {
  methods: ["GET", "POST"],
  route: "ops/leagues",
  handler: async (request) => handleAdminLeagues(request)
});

app.http("adminLeaguesItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/leagues/{id}",
  handler: async (request, context) => handleAdminLeagues(request, getRouteId(request, context))
});

app.http("adminCourtsCollection", {
  methods: ["GET", "POST"],
  route: "ops/courts",
  handler: async (request) => handleAdminCourts(request)
});

app.http("adminCourtsItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/courts/{id}",
  handler: async (request, context) => handleAdminCourts(request, getRouteId(request, context))
});

const saveMatch = async (payload, existingMatchId = null) => {
  const gameType = payload.gameType === "Ladder" ? "Ladder" : "Doubles";
  const scoringType = payload.scoringType === "Rally" ? "Rally" : "Standard";
  const isDoubles = gameType === "Doubles";
  const traceId = createTraceId();

  const allPlayers = [
    ...(payload.teamAPlayers ?? []),
    ...(payload.teamBPlayers ?? [])
  ];

  if (!Array.isArray(payload.teamAPlayers) || !Array.isArray(payload.teamBPlayers) || allPlayers.length !== 4) {
    return badRequest("A match must include exactly two players on each team.");
  }

  if (new Set(allPlayers).size !== 4) {
    return badRequest("Players in a match must be unique.");
  }

  if (!payload.courtId) {
    return badRequest("Field 'courtId' is required.");
  }

  if (isDoubles && (!payload.teamAId || !payload.teamBId || payload.teamAId === payload.teamBId)) {
    return badRequest("Doubles matches must include two distinct teams.");
  }

  const teamAId = isDoubles ? payload.teamAId : null;
  const teamBId = isDoubles ? payload.teamBId : null;

  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();
    let participantsDeleted = 0;
    let participantsInserted = 0;
    let matchesUpdated = 0;

    let matchId = existingMatchId;
    if (!existingMatchId) {
      const insertRequest = new sql.Request(tx);
      insertRequest.input("leagueId", sql.UniqueIdentifier, payload.leagueId);
      insertRequest.input("courtId", sql.UniqueIdentifier, payload.courtId);
      insertRequest.input("scoringType", sql.NVarChar(20), scoringType);
      insertRequest.input("gameType", sql.NVarChar(20), gameType);
      insertRequest.input("matchDate", sql.Date, payload.date);
      insertRequest.input("teamAId", sql.UniqueIdentifier, teamAId);
      insertRequest.input("teamBId", sql.UniqueIdentifier, teamBId);
      insertRequest.input("scoreA", sql.Int, payload.scoreA);
      insertRequest.input("scoreB", sql.Int, payload.scoreB);

      const matchResult = await insertRequest.query(`
        INSERT INTO matches (league_id, court_id, scoring_type, game_type, match_date, team_a_id, team_b_id, score_a, score_b)
        OUTPUT INSERTED.id
        VALUES (@leagueId, @courtId, @scoringType, @gameType, @matchDate, @teamAId, @teamBId, @scoreA, @scoreB);
      `);
      matchId = matchResult.recordset[0].id;
    } else {
      const updateRequest = new sql.Request(tx);
      updateRequest.input("id", sql.UniqueIdentifier, existingMatchId);
      updateRequest.input("leagueId", sql.UniqueIdentifier, payload.leagueId);
      updateRequest.input("courtId", sql.UniqueIdentifier, payload.courtId);
      updateRequest.input("scoringType", sql.NVarChar(20), scoringType);
      updateRequest.input("gameType", sql.NVarChar(20), gameType);
      updateRequest.input("matchDate", sql.Date, payload.date);
      updateRequest.input("teamAId", sql.UniqueIdentifier, teamAId);
      updateRequest.input("teamBId", sql.UniqueIdentifier, teamBId);
      updateRequest.input("scoreA", sql.Int, payload.scoreA);
      updateRequest.input("scoreB", sql.Int, payload.scoreB);

      const updateResult = await updateRequest.query(`
        UPDATE matches
        SET league_id = @leagueId,
            court_id = @courtId,
            scoring_type = @scoringType,
            game_type = @gameType,
            match_date = @matchDate,
            team_a_id = @teamAId,
            team_b_id = @teamBId,
            score_a = @scoreA,
            score_b = @scoreB
        WHERE id = @id;
      `);
      matchesUpdated = updateResult.rowsAffected?.[0] ?? 0;

      if (matchesUpdated === 0) {
        throw new Error(`No match row was updated for id ${existingMatchId}.`);
      }

      const clearParticipantsRequest = new sql.Request(tx);
      clearParticipantsRequest.input("matchId", sql.UniqueIdentifier, existingMatchId);
      const clearResult = await clearParticipantsRequest.query("DELETE FROM match_participants WHERE match_id = @matchId;");
      participantsDeleted = clearResult.rowsAffected?.[0] ?? 0;
    }

    for (let i = 0; i < payload.teamAPlayers.length; i += 1) {
      const participantRequest = new sql.Request(tx);
      participantRequest.input("matchId", sql.UniqueIdentifier, matchId);
      participantRequest.input("playerId", sql.UniqueIdentifier, payload.teamAPlayers[i]);
      participantRequest.input("teamSide", sql.Char(1), "A");
      participantRequest.input("teamId", sql.UniqueIdentifier, teamAId);
      participantRequest.input("participantOrder", sql.TinyInt, i + 1);
      await participantRequest.query(`
        INSERT INTO match_participants (match_id, player_id, team_side, team_id, participant_order)
        VALUES (@matchId, @playerId, @teamSide, @teamId, @participantOrder);
      `);
      participantsInserted += 1;
    }

    for (let i = 0; i < payload.teamBPlayers.length; i += 1) {
      const participantRequest = new sql.Request(tx);
      participantRequest.input("matchId", sql.UniqueIdentifier, matchId);
      participantRequest.input("playerId", sql.UniqueIdentifier, payload.teamBPlayers[i]);
      participantRequest.input("teamSide", sql.Char(1), "B");
      participantRequest.input("teamId", sql.UniqueIdentifier, teamBId);
      participantRequest.input("participantOrder", sql.TinyInt, i + 1);
      await participantRequest.query(`
        INSERT INTO match_participants (match_id, player_id, team_side, team_id, participant_order)
        VALUES (@matchId, @playerId, @teamSide, @teamId, @participantOrder);
      `);
      participantsInserted += 1;
    }

    await tx.commit();
    return json(
      {
        id: matchId,
        traceId,
        mode: existingMatchId ? "update" : "create",
        debug: {
          matchesUpdated,
          participantsDeleted,
          participantsInserted,
          gameType,
          scoringType,
          teamAId,
          teamBId,
          playerIds: allPlayers
        }
      },
      existingMatchId ? 200 : 201
    );
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Rollback errors should not hide the original database error.
    }

    const message = error instanceof Error ? error.message : String(error);
    const sqlError = (typeof error === "object" && error !== null
      ? error
      : {}) ;
    console.error("saveMatch failed", {
      traceId,
      mode: existingMatchId ? "update" : "create",
      message,
      code: sqlError.code,
      number: sqlError.number,
      state: sqlError.state,
      class: sqlError.class,
      lineNumber: sqlError.lineNumber
    });
    return json(
      {
        error: message,
        message,
        traceId,
        debug: {
          mode: existingMatchId ? "update" : "create",
          existingMatchId,
          gameType,
          scoringType,
          teamAId,
          teamBId,
          playerIds: allPlayers,
          scoreA: payload.scoreA,
          scoreB: payload.scoreB,
          sql: {
            code: sqlError.code ?? null,
            number: sqlError.number ?? null,
            state: sqlError.state ?? null,
            class: sqlError.class ?? null,
            lineNumber: sqlError.lineNumber ?? null
          }
        }
      },
      409
    );
  }
};

app.http("adminMatchesCollection", {
  methods: ["GET", "POST"],
  route: "ops/matches",
  handler: async (request) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    try {
      if (request.method === "GET") {
        const result = await runQuery(`
          SELECT
            m.id,
            m.league_id AS leagueId,
            m.court_id AS courtId,
            m.scoring_type AS scoringType,
            m.game_type AS gameType,
            CONVERT(varchar(10), m.match_date, 120) AS date,
            m.team_a_id AS teamAId,
            m.team_b_id AS teamBId,
            m.score_a AS scoreA,
            m.score_b AS scoreB,
            l.name + ' (' + CONVERT(varchar(10), l.start_date, 120) + ')' AS leagueName,
            c.name AS courtName,
            CASE
              WHEN m.game_type = 'Ladder' THEN pa1.first_name + ' & ' + pa2.first_name
              ELSE COALESCE(ta.name, 'Ladder Side A')
            END AS teamAName,
            CASE
              WHEN m.game_type = 'Ladder' THEN pb1.first_name + ' & ' + pb2.first_name
              ELSE COALESCE(tb.name, 'Ladder Side B')
            END AS teamBName,
            mpa1.player_id AS teamAPlayer1,
            mpa2.player_id AS teamAPlayer2,
            mpb1.player_id AS teamBPlayer1,
            mpb2.player_id AS teamBPlayer2,
            pa1.first_name + ' ' + pa1.last_name AS teamAPlayer1Name,
            pa2.first_name + ' ' + pa2.last_name AS teamAPlayer2Name,
            pb1.first_name + ' ' + pb1.last_name AS teamBPlayer1Name,
            pb2.first_name + ' ' + pb2.last_name AS teamBPlayer2Name
          FROM matches m
          JOIN leagues l ON l.id = m.league_id
          LEFT JOIN courts c ON c.id = m.court_id
          LEFT JOIN teams ta ON ta.id = m.team_a_id
          LEFT JOIN teams tb ON tb.id = m.team_b_id
          JOIN match_participants mpa1 ON mpa1.match_id = m.id AND mpa1.team_side = 'A' AND mpa1.participant_order = 1
          JOIN match_participants mpa2 ON mpa2.match_id = m.id AND mpa2.team_side = 'A' AND mpa2.participant_order = 2
          JOIN match_participants mpb1 ON mpb1.match_id = m.id AND mpb1.team_side = 'B' AND mpb1.participant_order = 1
          JOIN match_participants mpb2 ON mpb2.match_id = m.id AND mpb2.team_side = 'B' AND mpb2.participant_order = 2
          JOIN players pa1 ON pa1.id = mpa1.player_id
          JOIN players pa2 ON pa2.id = mpa2.player_id
          JOIN players pb1 ON pb1.id = mpb1.player_id
          JOIN players pb2 ON pb2.id = mpb2.player_id
          ORDER BY m.match_date DESC, m.created_at DESC;
        `);

        const mapped = result.recordset.map((row) => ({
          id: row.id,
          leagueId: row.leagueId,
          courtId: row.courtId,
          scoringType: row.scoringType,
          gameType: row.gameType,
          date: row.date,
          teamAId: row.teamAId ?? "",
          teamBId: row.teamBId ?? "",
          scoreA: row.scoreA,
          scoreB: row.scoreB,
          leagueName: row.leagueName,
          courtName: row.courtName,
          teamAName: row.teamAName,
          teamBName: row.teamBName,
          teamAPlayers: [row.teamAPlayer1, row.teamAPlayer2],
          teamBPlayers: [row.teamBPlayer1, row.teamBPlayer2],
          teamAPlayerNames: [row.teamAPlayer1Name, row.teamAPlayer2Name],
          teamBPlayerNames: [row.teamBPlayer1Name, row.teamBPlayer2Name]
        }));

        return json(mapped);
      }

      const payload = await parseJson(request);
      if (!payload) return badRequest("Invalid JSON body.");
      return saveMatch(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const traceId = createTraceId();
      console.error("adminMatchesCollection failed", { traceId, message });
      return json({ error: message, message, traceId }, 500);
    }
  }
});

app.http("adminMatchesItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/matches/{id}",
  handler: async (request, context) => {
    try {
      const authError = requireAdmin(request);
      if (authError) return authError;

      const idFromContext = context?.bindingData?.id;
      const idFromParamsObject = request?.params && typeof request.params === "object"
        ? request.params.id
        : undefined;
      const idFromParamsMap = request?.params && typeof request.params.get === "function"
        ? request.params.get("id")
        : undefined;
      const id = idFromContext || idFromParamsObject || idFromParamsMap;

      if (!id) {
        return json(
          {
            error: "Missing route parameter: id.",
            message: "Missing route parameter: id.",
            traceId: createTraceId(),
            debug: {
              hasContext: Boolean(context),
              hasBindingData: Boolean(context?.bindingData),
              requestUrl: request.url,
              method: request.method
            }
          },
          400
        );
      }

      if (request.method === "DELETE") {
        await runQuery("DELETE FROM matches WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
        return json({ deleted: true });
      }

      const payload = await parseJson(request);
      if (!payload) return badRequest("Invalid JSON body.");
      return saveMatch(payload, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const traceId = createTraceId();
      console.error("adminMatchesItem failed", {
        traceId,
        message,
        method: request.method,
        url: request.url,
        hasContext: Boolean(context),
        hasBindingData: Boolean(context?.bindingData)
      });
      return json(
        {
          error: message,
          message,
          traceId,
          debug: {
            method: request.method,
            url: request.url,
            hasContext: Boolean(context),
            hasBindingData: Boolean(context?.bindingData)
          }
        },
        409
      );
    }
  }
});

app.http("duprExport", {
  methods: ["GET"],
  route: "exports/dupr",
  handler: async (request) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    const date = request.query.get("date");
    if (!date) return badRequest("Query parameter 'date' is required.");

    try {
      const result = await runQuery(
        `
        SELECT
          m.match_date AS matchDate,
          l.name + ' (' + CONVERT(varchar(10), l.start_date, 120) + ')' AS league,
          ta.name AS teamA,
          pa1.first_name + ' ' + pa1.last_name AS teamAPlayer1,
          pa2.first_name + ' ' + pa2.last_name AS teamAPlayer2,
          m.score_a AS scoreA,
          tb.name AS teamB,
          pb1.first_name + ' ' + pb1.last_name AS teamBPlayer1,
          pb2.first_name + ' ' + pb2.last_name AS teamBPlayer2,
          m.score_b AS scoreB,
          CASE WHEN m.score_a > m.score_b THEN ta.name ELSE tb.name END AS winnerTeam
        FROM matches m
        JOIN leagues l ON l.id = m.league_id
        JOIN teams ta ON ta.id = m.team_a_id
        JOIN teams tb ON tb.id = m.team_b_id
        JOIN match_participants mpa1 ON mpa1.match_id = m.id AND mpa1.team_side = 'A' AND mpa1.participant_order = 1
        JOIN match_participants mpa2 ON mpa2.match_id = m.id AND mpa2.team_side = 'A' AND mpa2.participant_order = 2
        JOIN match_participants mpb1 ON mpb1.match_id = m.id AND mpb1.team_side = 'B' AND mpb1.participant_order = 1
        JOIN match_participants mpb2 ON mpb2.match_id = m.id AND mpb2.team_side = 'B' AND mpb2.participant_order = 2
        JOIN players pa1 ON pa1.id = mpa1.player_id
        JOIN players pa2 ON pa2.id = mpa2.player_id
        JOIN players pb1 ON pb1.id = mpb1.player_id
        JOIN players pb2 ON pb2.id = mpb2.player_id
        WHERE m.match_date = @date
          AND m.game_type = 'Doubles'
        ORDER BY m.match_date, m.created_at;
      `,
        [{ name: "date", type: sql.Date, value: date }]
      );

      const header = [
        "match_date",
        "league",
        "team_a",
        "team_a_player_1",
        "team_a_player_2",
        "team_a_score",
        "team_b",
        "team_b_player_1",
        "team_b_player_2",
        "team_b_score",
        "winner_team"
      ];

      const rows = result.recordset.map((row) => [
        row.matchDate,
        row.league,
        row.teamA,
        row.teamAPlayer1,
        row.teamAPlayer2,
        row.scoreA,
        row.teamB,
        row.teamBPlayer1,
        row.teamBPlayer2,
        row.scoreB,
        row.winnerTeam
      ]);

      return csv(toCsv(header, rows), `hwpl-dupr-export-${date}.csv`);
    } catch (error) {
      return serverError(error.message);
    }
  }
});
