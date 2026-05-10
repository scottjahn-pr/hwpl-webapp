import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { League, LeagueStatRow, Persona, Player, RecentMatch, StatsRow, Team } from "./types";


type PlayerForm = Omit<Player, "id">;
type TeamForm = Omit<Team, "id">;
type LeagueForm = Omit<League, "id">;

interface MatchForm {
  leagueId: string;
  date: string;
  teamAId: string;
  teamBId: string;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  scoreA: string;
  scoreB: string;
}

const emptyPlayerForm: PlayerForm = {
  firstName: "",
  lastName: "",
  email: "",
  duprId: "",
  defaultTeamId: ""
};

const emptyTeamForm: TeamForm = {
  name: "",
  leagueId: ""
};

const emptyLeagueForm: LeagueForm = {
  name: "",
  season: "",
  isActive: true
};



function App() {
  const [persona, setPersona] = useState<Persona>("user");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Reference data (for forms / admin lists)
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  // Pre-computed stats from the API
  const [playerStats, setPlayerStats] = useState<StatsRow[]>([]);
  const [teamStats, setTeamStats] = useState<StatsRow[]>([]);
  const [leagueStats, setLeagueStats] = useState<LeagueStatRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  // Form state
  const [playerForm, setPlayerForm] = useState<PlayerForm>({ ...emptyPlayerForm });
  const [teamForm, setTeamForm] = useState<TeamForm>({ ...emptyTeamForm });
  const [leagueForm, setLeagueForm] = useState<LeagueForm>({ ...emptyLeagueForm });

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);

  const [matchForm, setMatchForm] = useState<MatchForm>({
    leagueId: "",
    date: new Date().toISOString().slice(0, 10),
    teamAId: "",
    teamBId: "",
    teamAPlayer1: "",
    teamAPlayer2: "",
    teamBPlayer1: "",
    teamBPlayer2: "",
    scoreA: "11",
    scoreB: "8"
  });

  const [matchError, setMatchError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [csvDate, setCsvDate] = useState(new Date().toISOString().slice(0, 10));

  const loadStats = useCallback(async () => {
    const [psRes, tsRes, lsRes, rmRes] = await Promise.all([
      fetch("/api/stats/players"),
      fetch("/api/stats/teams"),
      fetch("/api/stats/leagues"),
      fetch("/api/stats/matches")
    ]);
    if (psRes.ok) setPlayerStats(await psRes.json());
    if (tsRes.ok) setTeamStats(await tsRes.json());
    if (lsRes.ok) setLeagueStats(await lsRes.json());
    if (rmRes.ok) setRecentMatches(await rmRes.json());
  }, []);

  const loadAdminData = useCallback(async () => {
    const [lRes, tRes, pRes] = await Promise.all([
      fetch("/api/admin/leagues"),
      fetch("/api/admin/teams"),
      fetch("/api/admin/players")
    ]);
    const loadedLeagues: League[] = lRes.ok ? await lRes.json() : [];
    const loadedTeams: Team[] = tRes.ok ? await tRes.json() : [];
    const loadedPlayers: Player[] = pRes.ok ? await pRes.json() : [];

    setLeagues(loadedLeagues);
    setTeams(loadedTeams);
    setPlayers(loadedPlayers);

    // Seed form defaults the first time data arrives
    setPlayerForm((prev) => ({ ...prev, defaultTeamId: prev.defaultTeamId || loadedTeams[0]?.id || "" }));
    setTeamForm((prev) => ({ ...prev, leagueId: prev.leagueId || loadedLeagues[0]?.id || "" }));
    setMatchForm((prev) =>
      prev.teamAId
        ? prev
        : {
            ...prev,
            leagueId: loadedLeagues[0]?.id ?? "",
            teamAId: loadedTeams[0]?.id ?? "",
            teamBId: loadedTeams[1]?.id ?? loadedTeams[0]?.id ?? "",
            teamAPlayer1: loadedPlayers[0]?.id ?? "",
            teamAPlayer2: loadedPlayers[1]?.id ?? "",
            teamBPlayer1: loadedPlayers[2]?.id ?? "",
            teamBPlayer2: loadedPlayers[3]?.id ?? ""
          }
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadAdminData()])
      .catch(() => setApiError("Could not reach the API. Verify the SQL_CONNECTION_STRING app setting is configured."))
      .finally(() => setLoading(false));
  }, [loadStats, loadAdminData]);

  const leagueNameById = useMemo(() => new Map(leagues.map((l) => [l.id, `${l.name} (${l.season})`])), [leagues]);

  const totalMatches = useMemo(() => leagueStats.reduce((sum, l) => sum + l.matches, 0), [leagueStats]);
  const totalPlayers = players.length;
  const totalTeams = teams.length;

  const onSavePlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingPlayerId) {
        await fetch(`/api/admin/players/${editingPlayerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playerForm)
        });
        setAdminMessage("Player updated.");
      } else {
        await fetch("/api/admin/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playerForm)
        });
        setAdminMessage("Player added.");
      }
      setEditingPlayerId(null);
      setPlayerForm({ ...emptyPlayerForm, defaultTeamId: teams[0]?.id ?? "" });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving player.");
    }
  };

  const onSaveTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingTeamId) {
        await fetch(`/api/admin/teams/${editingTeamId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teamForm)
        });
        setAdminMessage("Team updated.");
      } else {
        await fetch("/api/admin/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teamForm)
        });
        setAdminMessage("Team added.");
      }
      setEditingTeamId(null);
      setTeamForm({ ...emptyTeamForm, leagueId: leagues[0]?.id ?? "" });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving team.");
    }
  };

  const onSaveLeague = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingLeagueId) {
        await fetch(`/api/admin/leagues/${editingLeagueId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leagueForm)
        });
        setAdminMessage("League updated.");
      } else {
        await fetch("/api/admin/leagues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leagueForm)
        });
        setAdminMessage("League added.");
      }
      setEditingLeagueId(null);
      setLeagueForm({ ...emptyLeagueForm });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving league.");
    }
  };


  const onDeletePlayer = async (playerId: string) => {
    try {
      await fetch(`/api/admin/players/${playerId}`, { method: "DELETE" });
      setAdminMessage("Player removed.");
      await Promise.all([loadAdminData(), loadStats()]);
    } catch {
      setAdminMessage("Error removing player.");
    }
  };

  const onDeleteTeam = async (teamId: string) => {
    try {
      await fetch(`/api/admin/teams/${teamId}`, { method: "DELETE" });
      setAdminMessage("Team removed.");
      await Promise.all([loadAdminData(), loadStats()]);
    } catch {
      setAdminMessage("Error removing team.");
    }
  };

  const onDeleteLeague = async (leagueId: string) => {
    try {
      await fetch(`/api/admin/leagues/${leagueId}`, { method: "DELETE" });
      setAdminMessage("League removed.");
      await Promise.all([loadAdminData(), loadStats()]);
    } catch {
      setAdminMessage("Error removing league.");
    }
  };

  const onRecordMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMatchError("");

    if (matchForm.teamAId === matchForm.teamBId) {
      setMatchError("Team A and Team B must be different.");
      return;
    }

    const pickedPlayers = [matchForm.teamAPlayer1, matchForm.teamAPlayer2, matchForm.teamBPlayer1, matchForm.teamBPlayer2];
    if (new Set(pickedPlayers).size !== 4) {
      setMatchError("All selected players must be unique within a match.");
      return;
    }

    const scoreA = Number(matchForm.scoreA);
    const scoreB = Number(matchForm.scoreB);
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
      setMatchError("Scores must be whole numbers and cannot be tied.");
      return;
    }

    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: matchForm.leagueId,
          date: matchForm.date,
          teamAId: matchForm.teamAId,
          teamBId: matchForm.teamBId,
          teamAPlayers: [matchForm.teamAPlayer1, matchForm.teamAPlayer2],
          teamBPlayers: [matchForm.teamBPlayer1, matchForm.teamBPlayer2],
          scoreA,
          scoreB
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setMatchError(err.message ?? "Failed to record match.");
        return;
      }

      setAdminMessage("Match result recorded.");
      await loadStats();
    } catch {
      setMatchError("Network error recording match.");
    }
  };

  const exportMatchesForDay = async () => {
    try {
      const res = await fetch(`/api/exports/dupr?date=${csvDate}`);
      if (!res.ok) {
        setAdminMessage("Export failed. No matches for that date, or server error.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hwpl-dupr-export-${csvDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setAdminMessage(`Export triggered for ${csvDate}.`);
    } catch {
      setAdminMessage("Export failed.");
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-brand-row">
          <img className="club-logo" src="/brand/HW PickleBall Logo.png" alt="Hiram Walker Pickleball Club logo" />
          <div>
            <p className="eyebrow">Hiram Walker Pickleball League</p>
            <h1>League Operations and Stats Portal</h1>
          </div>
        </div>
        <p>
          This foundation supports both personas: users can view player, team, and league stats; admins can manage league
          entities and record match outcomes.
        </p>

        {apiError ? <p className="panel status-msg" style={{ color: "red" }}>{apiError}</p> : null}

        <div className="hero-metrics">
          <article>
            <h2>{loading ? "…" : totalMatches}</h2>
            <p>Matches</p>
          </article>
          <article>
            <h2>{loading ? "…" : totalPlayers}</h2>
            <p>Players</p>
          </article>
          <article>
            <h2>{loading ? "…" : totalTeams}</h2>
            <p>Teams</p>
          </article>
        </div>

        <div className="persona-switch" role="tablist" aria-label="Persona switch">
          <button type="button" className={persona === "user" ? "active" : ""} onClick={() => setPersona("user")}>
            Regular User View
          </button>
          <button type="button" className={persona === "admin" ? "active" : ""} onClick={() => setPersona("admin")}>
            Admin View
          </button>
        </div>
      </section>

      <section className="grid-layout">
        <article className="panel">
          <div className="panel-header">
            <h3>Player Stats</h3>
            <p>Includes games from default and non-default teams.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>GP</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Win %</th>
                  <th>PF</th>
                  <th>PA</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.gamesPlayed}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{(row.winRate * 100).toFixed(0)}%</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{row.differential}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Team Stats</h3>
            <p>Team totals include all matches where players represented that team.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>GP</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Win %</th>
                  <th>PF</th>
                  <th>PA</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.gamesPlayed}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{(row.winRate * 100).toFixed(0)}%</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{row.differential}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>League Stats</h3>
          <p>Aggregated totals by league and season.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>League</th>
                <th>Matches</th>
                <th>Avg Points / Match</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {leagueStats.map((row) => (
                <tr key={row.id}>
                  <td>{row.name} ({row.season})</td>
                  <td>{row.matches}</td>
                  <td>{row.avgPointsPerMatch.toFixed(1)}</td>
                  <td>{row.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel match-log">
        <div className="panel-header">
          <h3>Recent Matches</h3>
          <p>Latest 10 match entries.</p>
        </div>
        <ul>
          {recentMatches.map((match) => (
            <li key={match.id}>
              <span>{match.date}</span>
              <strong>{match.teamA}</strong>
              <em>{match.scoreA}</em>
              <em>{match.scoreB}</em>
              <strong>{match.teamB}</strong>
            </li>
          ))}
        </ul>
      </section>

      {persona === "admin" ? (
        <section className="admin-grid">
          <article className="panel">
            <div className="panel-header">
              <h3>Manage Players</h3>
              <p>Add, remove, or modify player records.</p>
            </div>
            <form className="match-form" onSubmit={onSavePlayer}>
              <div className="teams-grid">
                <label>
                  First Name
                  <input value={playerForm.firstName} onChange={(e) => setPlayerForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
                </label>
                <label>
                  Last Name
                  <input value={playerForm.lastName} onChange={(e) => setPlayerForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
                </label>
                <label>
                  Email
                  <input type="email" value={playerForm.email} onChange={(e) => setPlayerForm((prev) => ({ ...prev, email: e.target.value }))} required />
                </label>
                <label>
                  DUPR ID
                  <input value={playerForm.duprId} onChange={(e) => setPlayerForm((prev) => ({ ...prev, duprId: e.target.value }))} required />
                </label>
                <label>
                  Default Team
                  <select
                    value={playerForm.defaultTeamId}
                    onChange={(e) => setPlayerForm((prev) => ({ ...prev, defaultTeamId: e.target.value }))}
                    required
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit">{editingPlayerId ? "Update Player" : "Add Player"}</button>
            </form>
            <ul className="entity-list">
              {players.map((player) => (
                <li key={player.id}>
                  <span>{`${player.firstName} ${player.lastName}`} ({player.duprId})</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlayerId(player.id);
                        setPlayerForm({
                          firstName: player.firstName,
                          lastName: player.lastName,
                          email: player.email,
                          duprId: player.duprId,
                          defaultTeamId: player.defaultTeamId
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onDeletePlayer(player.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Manage Teams</h3>
              <p>Add, remove, or modify team records.</p>
            </div>
            <form className="match-form" onSubmit={onSaveTeam}>
              <label>
                Team Name
                <input value={teamForm.name} onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>
              <label>
                League
                <select value={teamForm.leagueId} onChange={(e) => setTeamForm((prev) => ({ ...prev, leagueId: e.target.value }))} required>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} ({league.season})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">{editingTeamId ? "Update Team" : "Add Team"}</button>
            </form>
            <ul className="entity-list">
              {teams.map((team) => (
                <li key={team.id}>
                  <span>{team.name} - {leagueNameById.get(team.leagueId)}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setTeamForm({ name: team.name, leagueId: team.leagueId });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onDeleteTeam(team.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Manage Leagues</h3>
              <p>Add, remove, or modify leagues.</p>
            </div>
            <form className="match-form" onSubmit={onSaveLeague}>
              <label>
                League Name
                <input value={leagueForm.name} onChange={(e) => setLeagueForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>
              <label>
                Season
                <input value={leagueForm.season} onChange={(e) => setLeagueForm((prev) => ({ ...prev, season: e.target.value }))} required />
              </label>
              <label>
                Active
                <select
                  value={leagueForm.isActive ? "yes" : "no"}
                  onChange={(e) => setLeagueForm((prev) => ({ ...prev, isActive: e.target.value === "yes" }))}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <button type="submit">{editingLeagueId ? "Update League" : "Add League"}</button>
            </form>
            <ul className="entity-list">
              {leagues.map((league) => (
                <li key={league.id}>
                  <span>{league.name} ({league.season})</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLeagueId(league.id);
                        setLeagueForm({ name: league.name, season: league.season, isActive: league.isActive });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onDeleteLeague(league.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Record Match Result</h3>
              <p>Admins can add individual match outcomes.</p>
            </div>
            <form className="match-form" onSubmit={onRecordMatch}>
              <label>
                League
                <select value={matchForm.leagueId} onChange={(e) => setMatchForm((prev) => ({ ...prev, leagueId: e.target.value }))} required>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} ({league.season})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={matchForm.date} onChange={(e) => setMatchForm((prev) => ({ ...prev, date: e.target.value }))} required />
              </label>
              <div className="teams-grid">
                <label>
                  Team A
                  <select value={matchForm.teamAId} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAId: e.target.value }))} required>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Team B
                  <select value={matchForm.teamBId} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBId: e.target.value }))} required>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="teams-grid">
                <label>
                  Team A - Player 1
                  <select value={matchForm.teamAPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer1: e.target.value }))}>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.firstName} {player.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Team A - Player 2
                  <select value={matchForm.teamAPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer2: e.target.value }))}>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.firstName} {player.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Team B - Player 1
                  <select value={matchForm.teamBPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer1: e.target.value }))}>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.firstName} {player.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Team B - Player 2
                  <select value={matchForm.teamBPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer2: e.target.value }))}>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.firstName} {player.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="score-row">
                <label>
                  Team A Score
                  <input type="number" min={0} step={1} value={matchForm.scoreA} onChange={(e) => setMatchForm((prev) => ({ ...prev, scoreA: e.target.value }))} required />
                </label>
                <label>
                  Team B Score
                  <input type="number" min={0} step={1} value={matchForm.scoreB} onChange={(e) => setMatchForm((prev) => ({ ...prev, scoreB: e.target.value }))} required />
                </label>
              </div>
              {matchError ? <p className="form-error">{matchError}</p> : null}
              <button type="submit">Save Match</button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>CSV Export for DUPR</h3>
              <p>Exports all matches for one day. The exact DUPR format can be swapped in later.</p>
            </div>
            <div className="match-form">
              <label>
                Export Date
                <input type="date" value={csvDate} onChange={(e) => setCsvDate(e.target.value)} />
              </label>
              <button type="button" onClick={exportMatchesForDay}>
                Export CSV
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {adminMessage ? <p className="panel status-msg">{adminMessage}</p> : null}
    </main>
  );
}

export default App;
