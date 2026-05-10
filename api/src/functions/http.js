import { app } from "@azure/functions";
import { isAdmin } from "../lib/auth.js";
import { toCsv } from "../lib/csv.js";
import { getPool, runQuery, sql } from "../lib/db.js";
import { badRequest, json, parseJson, serverError, unauthorized, csv } from "../lib/http.js";

const requireAdmin = (request) => {
  return isAdmin(request) ? null : unauthorized();
};

app.http("health", {
  methods: ["GET"],
  route: "health",
  handler: async () => json({ ok: true, service: "hwpl-api" })
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
          l.season,
          l.is_active AS isActive,
          COUNT(m.id) AS matches,
          CASE WHEN COUNT(m.id) = 0 THEN 0 ELSE CAST(SUM(m.score_a + m.score_b) AS float) / COUNT(m.id) END AS avgPointsPerMatch
        FROM leagues l
        LEFT JOIN matches m ON m.league_id = l.id
        GROUP BY l.id, l.name, l.season, l.is_active
        ORDER BY l.name, l.season;
      `);

      return json(result.recordset);
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("adminPlayers", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  route: "admin/players/{id?}",
  handler: async (request, context) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    try {
      if (request.method === "GET") {
        const result = await runQuery(`
          SELECT id, first_name AS firstName, last_name AS lastName, email, dupr_id AS duprId, default_team_id AS defaultTeamId
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
          INSERT INTO players (first_name, last_name, email, dupr_id, default_team_id)
          OUTPUT INSERTED.id
          VALUES (@firstName, @lastName, @email, @duprId, @defaultTeamId);
          `,
          [
            { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
            { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
            { name: "email", type: sql.NVarChar(250), value: payload.email },
            { name: "duprId", type: sql.NVarChar(100), value: payload.duprId },
            { name: "defaultTeamId", type: sql.UniqueIdentifier, value: payload.defaultTeamId || null }
          ]
        );

        return json({ id: result.recordset[0].id }, 201);
      }

      const id = context.bindingData.id;
      if (!id) return badRequest("Missing route parameter: id.");

      if (request.method === "PUT") {
        await runQuery(
          `
          UPDATE players
          SET first_name = @firstName,
              last_name = @lastName,
              email = @email,
              dupr_id = @duprId,
              default_team_id = @defaultTeamId
          WHERE id = @id;
          `,
          [
            { name: "id", type: sql.UniqueIdentifier, value: id },
            { name: "firstName", type: sql.NVarChar(120), value: payload.firstName },
            { name: "lastName", type: sql.NVarChar(120), value: payload.lastName },
            { name: "email", type: sql.NVarChar(250), value: payload.email },
            { name: "duprId", type: sql.NVarChar(100), value: payload.duprId },
            { name: "defaultTeamId", type: sql.UniqueIdentifier, value: payload.defaultTeamId || null }
          ]
        );

        return json({ updated: true });
      }

      await runQuery("DELETE FROM players WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
      return json({ deleted: true });
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("adminTeams", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  route: "admin/teams/{id?}",
  handler: async (request, context) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    try {
      if (request.method === "GET") {
        const result = await runQuery("SELECT id, name, league_id AS leagueId FROM teams ORDER BY name;");
        return json(result.recordset);
      }

      const payload = await parseJson(request);
      if (!payload) return badRequest("Invalid JSON body.");

      if (request.method === "POST") {
        const result = await runQuery(
          "INSERT INTO teams (name, league_id) OUTPUT INSERTED.id VALUES (@name, @leagueId);",
          [
            { name: "name", type: sql.NVarChar(120), value: payload.name },
            { name: "leagueId", type: sql.UniqueIdentifier, value: payload.leagueId }
          ]
        );
        return json({ id: result.recordset[0].id }, 201);
      }

      const id = context.bindingData.id;
      if (!id) return badRequest("Missing route parameter: id.");

      if (request.method === "PUT") {
        await runQuery(
          "UPDATE teams SET name = @name, league_id = @leagueId WHERE id = @id;",
          [
            { name: "id", type: sql.UniqueIdentifier, value: id },
            { name: "name", type: sql.NVarChar(120), value: payload.name },
            { name: "leagueId", type: sql.UniqueIdentifier, value: payload.leagueId }
          ]
        );
        return json({ updated: true });
      }

      await runQuery("DELETE FROM teams WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
      return json({ deleted: true });
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("adminLeagues", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  route: "admin/leagues/{id?}",
  handler: async (request, context) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    try {
      if (request.method === "GET") {
        const result = await runQuery("SELECT id, name, season, is_active AS isActive FROM leagues ORDER BY name, season;");
        return json(result.recordset);
      }

      const payload = await parseJson(request);
      if (!payload) return badRequest("Invalid JSON body.");

      if (request.method === "POST") {
        const result = await runQuery(
          "INSERT INTO leagues (name, season, is_active) OUTPUT INSERTED.id VALUES (@name, @season, @isActive);",
          [
            { name: "name", type: sql.NVarChar(120), value: payload.name },
            { name: "season", type: sql.NVarChar(80), value: payload.season },
            { name: "isActive", type: sql.Bit, value: Boolean(payload.isActive) }
          ]
        );
        return json({ id: result.recordset[0].id }, 201);
      }

      const id = context.bindingData.id;
      if (!id) return badRequest("Missing route parameter: id.");

      if (request.method === "PUT") {
        await runQuery(
          "UPDATE leagues SET name = @name, season = @season, is_active = @isActive WHERE id = @id;",
          [
            { name: "id", type: sql.UniqueIdentifier, value: id },
            { name: "name", type: sql.NVarChar(120), value: payload.name },
            { name: "season", type: sql.NVarChar(80), value: payload.season },
            { name: "isActive", type: sql.Bit, value: Boolean(payload.isActive) }
          ]
        );
        return json({ updated: true });
      }

      await runQuery("DELETE FROM leagues WHERE id = @id;", [{ name: "id", type: sql.UniqueIdentifier, value: id }]);
      return json({ deleted: true });
    } catch (error) {
      return serverError(error.message);
    }
  }
});

app.http("adminMatches", {
  methods: ["POST"],
  route: "admin/matches",
  handler: async (request) => {
    const authError = requireAdmin(request);
    if (authError) return authError;

    const payload = await parseJson(request);
    if (!payload) return badRequest("Invalid JSON body.");

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

      const matchRequest = new sql.Request(tx);
      matchRequest.input("leagueId", sql.UniqueIdentifier, payload.leagueId);
      matchRequest.input("matchDate", sql.Date, payload.date);
      matchRequest.input("teamAId", sql.UniqueIdentifier, payload.teamAId);
      matchRequest.input("teamBId", sql.UniqueIdentifier, payload.teamBId);
      matchRequest.input("scoreA", sql.Int, payload.scoreA);
      matchRequest.input("scoreB", sql.Int, payload.scoreB);

      const matchResult = await matchRequest.query(`
        INSERT INTO matches (league_id, match_date, team_a_id, team_b_id, score_a, score_b)
        OUTPUT INSERTED.id
        VALUES (@leagueId, @matchDate, @teamAId, @teamBId, @scoreA, @scoreB);
      `);

      const matchId = matchResult.recordset[0].id;
      const participantRequest = new sql.Request(tx);
      participantRequest.input("matchId", sql.UniqueIdentifier, matchId);

      for (let i = 0; i < payload.teamAPlayers.length; i += 1) {
        participantRequest.parameters = {};
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
        participantRequest.parameters = {};
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
      return json({ id: matchId }, 201);
    } catch (error) {
      await tx.rollback();
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
          l.name + ' (' + l.season + ')' AS league,
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
