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
        SELECT TOP 10
          m.id,
          CONVERT(varchar(10), m.match_date, 120) AS date,
          ta.name AS teamA,
          tb.name AS teamB,
          m.score_a AS scoreA,
          m.score_b AS scoreB
        FROM matches m
        JOIN teams ta ON ta.id = m.team_a_id
        JOIN teams tb ON tb.id = m.team_b_id
        ORDER BY m.match_date DESC, m.created_at DESC;
      `);
      return json(result.recordset);
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
          UNION ALL
          SELECT team_b_id AS team_id, score_b AS points_for, score_a AS points_against,
            CASE WHEN score_b > score_a THEN 1 ELSE 0 END AS win
          FROM matches
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

const handleAdminPlayers = async (request, id) => {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    if (request.method === "GET") {
      const result = await runQuery(`
        SELECT id, first_name AS firstName, last_name AS lastName, email, dupr_id AS duprId, default_team_id AS defaultTeamId, is_active AS isActive
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
        INSERT INTO players (first_name, last_name, email, dupr_id, default_team_id, is_active)
        OUTPUT INSERTED.id
        VALUES (@firstName, @lastName, @email, @duprId, @defaultTeamId, @isActive);
        `,
        [
          { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
          { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
          { name: "email", type: sql.NVarChar(250), value: payload.email },
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
            email = @email,
            dupr_id = @duprId,
            default_team_id = @defaultTeamId,
            is_active = @isActive
        WHERE id = @id;
        `,
        [
          { name: "id", type: sql.UniqueIdentifier, value: id },
          { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
          { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
          { name: "email", type: sql.NVarChar(250), value: payload.email },
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

  try {
    if (request.method === "GET") {
      const result = await runQuery("SELECT id, name, league_id AS leagueId, is_active AS isActive FROM teams ORDER BY name;");
      return json(result.recordset);
    }

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");

    if (request.method === "POST") {
      const result = await runQuery(
        "INSERT INTO teams (name, league_id, is_active) OUTPUT INSERTED.id VALUES (@name, @leagueId, @isActive);",
        [
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "leagueId", type: sql.UniqueIdentifier, value: payload.leagueId },
          { name: "isActive", type: sql.Bit, value: payload.isActive ?? true }
        ]
      );
      return json({ id: result.recordset[0].id }, 201);
    }

    if (!id) return badRequest("Missing route parameter: id.");

    if (request.method === "PUT") {
      await runQuery(
        "UPDATE teams SET name = @name, league_id = @leagueId, is_active = @isActive WHERE id = @id;",
        [
          { name: "id", type: sql.UniqueIdentifier, value: id },
          { name: "name", type: sql.NVarChar(120), value: payload.name },
          { name: "leagueId", type: sql.UniqueIdentifier, value: payload.leagueId },
          { name: "isActive", type: sql.Bit, value: payload.isActive ?? true }
        ]
      );
      return json({ updated: true });
    }

    await runQuery("UPDATE teams SET is_active = 0 WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
    return json({ deactivated: true });
  } catch (error) {
    return serverError(error.message);
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

app.http("adminPlayersCollection", {
  methods: ["GET", "POST"],
  route: "ops/players",
  handler: async (request) => handleAdminPlayers(request)
});

app.http("adminPlayersItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/players/{id}",
  handler: async (request, context) => handleAdminPlayers(request, context.bindingData.id)
});

app.http("adminTeamsCollection", {
  methods: ["GET", "POST"],
  route: "ops/teams",
  handler: async (request) => handleAdminTeams(request)
});

app.http("adminTeamsItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/teams/{id}",
  handler: async (request, context) => handleAdminTeams(request, context.bindingData.id)
});

app.http("adminLeaguesCollection", {
  methods: ["GET", "POST"],
  route: "ops/leagues",
  handler: async (request) => handleAdminLeagues(request)
});

app.http("adminLeaguesItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/leagues/{id}",
  handler: async (request, context) => handleAdminLeagues(request, context.bindingData.id)
});

const saveMatch = async (payload, existingMatchId = null) => {
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

  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    let matchId = existingMatchId;
    if (!existingMatchId) {
      const insertRequest = new sql.Request(tx);
      insertRequest.input("leagueId", sql.UniqueIdentifier, payload.leagueId);
      insertRequest.input("matchDate", sql.Date, payload.date);
      insertRequest.input("teamAId", sql.UniqueIdentifier, payload.teamAId);
      insertRequest.input("teamBId", sql.UniqueIdentifier, payload.teamBId);
      insertRequest.input("scoreA", sql.Int, payload.scoreA);
      insertRequest.input("scoreB", sql.Int, payload.scoreB);

      const matchResult = await insertRequest.query(`
        INSERT INTO matches (league_id, match_date, team_a_id, team_b_id, score_a, score_b)
        OUTPUT INSERTED.id
        VALUES (@leagueId, @matchDate, @teamAId, @teamBId, @scoreA, @scoreB);
      `);
      matchId = matchResult.recordset[0].id;
    } else {
      const updateRequest = new sql.Request(tx);
      updateRequest.input("id", sql.UniqueIdentifier, existingMatchId);
      updateRequest.input("leagueId", sql.UniqueIdentifier, payload.leagueId);
      updateRequest.input("matchDate", sql.Date, payload.date);
      updateRequest.input("teamAId", sql.UniqueIdentifier, payload.teamAId);
      updateRequest.input("teamBId", sql.UniqueIdentifier, payload.teamBId);
      updateRequest.input("scoreA", sql.Int, payload.scoreA);
      updateRequest.input("scoreB", sql.Int, payload.scoreB);

      await updateRequest.query(`
        UPDATE matches
        SET league_id = @leagueId,
            match_date = @matchDate,
            team_a_id = @teamAId,
            team_b_id = @teamBId,
            score_a = @scoreA,
            score_b = @scoreB
        WHERE id = @id;
      `);

      const clearParticipantsRequest = new sql.Request(tx);
      clearParticipantsRequest.input("matchId", sql.UniqueIdentifier, existingMatchId);
      await clearParticipantsRequest.query("DELETE FROM match_participants WHERE match_id = @matchId;");
    }

    for (let i = 0; i < payload.teamAPlayers.length; i += 1) {
      const participantRequest = new sql.Request(tx);
      participantRequest.input("matchId", sql.UniqueIdentifier, matchId);
      participantRequest.input("playerId", sql.UniqueIdentifier, payload.teamAPlayers[i]);
      participantRequest.input("teamSide", sql.Char(1), "A");
      participantRequest.input("teamId", sql.UniqueIdentifier, payload.teamAId);
      participantRequest.input("participantOrder", sql.TinyInt, i + 1);
      await participantRequest.query(`
        INSERT INTO match_participants (match_id, player_id, team_side, team_id, participant_order)
        VALUES (@matchId, @playerId, @teamSide, @teamId, @participantOrder);
      `);
    }

    for (let i = 0; i < payload.teamBPlayers.length; i += 1) {
      const participantRequest = new sql.Request(tx);
      participantRequest.input("matchId", sql.UniqueIdentifier, matchId);
      participantRequest.input("playerId", sql.UniqueIdentifier, payload.teamBPlayers[i]);
      participantRequest.input("teamSide", sql.Char(1), "B");
      participantRequest.input("teamId", sql.UniqueIdentifier, payload.teamBId);
      participantRequest.input("participantOrder", sql.TinyInt, i + 1);
      await participantRequest.query(`
        INSERT INTO match_participants (match_id, player_id, team_side, team_id, participant_order)
        VALUES (@matchId, @playerId, @teamSide, @teamId, @participantOrder);
      `);
    }

    await tx.commit();
    return json({ id: matchId }, existingMatchId ? 200 : 201);
  } catch (error) {
    await tx.rollback();
    return serverError(error.message);
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
            CONVERT(varchar(10), m.match_date, 120) AS date,
            m.team_a_id AS teamAId,
            m.team_b_id AS teamBId,
            m.score_a AS scoreA,
            m.score_b AS scoreB,
            l.name + ' (' + CONVERT(varchar(10), l.start_date, 120) + ')' AS leagueName,
            ta.name AS teamAName,
            tb.name AS teamBName,
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
          ORDER BY m.match_date DESC, m.created_at DESC;
        `);

        const mapped = result.recordset.map((row) => ({
          id: row.id,
          leagueId: row.leagueId,
          date: row.date,
          teamAId: row.teamAId,
          teamBId: row.teamBId,
          scoreA: row.scoreA,
          scoreB: row.scoreB,
          leagueName: row.leagueName,
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
      return serverError(error.message);
    }
  }
});

app.http("adminMatchesItem", {
  methods: ["PUT", "DELETE"],
  route: "ops/matches/{id}",
  handler: async (request, context) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    const id = context.bindingData.id;
    if (!id) return badRequest("Missing route parameter: id.");

    try {
      if (request.method === "DELETE") {
        await runQuery("DELETE FROM matches WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
        return json({ deleted: true });
      }

      const payload = await parseJson(request);
      if (!payload) return badRequest("Invalid JSON body.");
      return saveMatch(payload, id);
    } catch (error) {
      return serverError(error.message);
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
