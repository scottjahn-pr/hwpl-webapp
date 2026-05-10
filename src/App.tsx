import { FormEvent, useMemo, useState } from "react";
import { League, Match, Persona, Player, StatsRow, Team } from "./types";

const initialLeagues: League[] = [
  { id: "l1", name: "HWPL Premier", season: "Spring 2026", isActive: true },
  { id: "l2", name: "HWPL Social", season: "Spring 2026", isActive: true }
];

const initialTeams: Team[] = [
  { id: "t1", name: "River Volleys", leagueId: "l1" },
  { id: "t2", name: "Barrel Smash", leagueId: "l1" },
  { id: "t3", name: "Kitchen Kings", leagueId: "l2" },
  { id: "t4", name: "Baseline Crew", leagueId: "l2" }
];

const initialPlayers: Player[] = [
  { id: "p1", firstName: "Avery", lastName: "Martin", email: "avery@example.com", duprId: "D1001", defaultTeamId: "t1" },
  { id: "p2", firstName: "Jordan", lastName: "Lee", email: "jordan@example.com", duprId: "D1002", defaultTeamId: "t1" },
  { id: "p3", firstName: "Casey", lastName: "Nguyen", email: "casey@example.com", duprId: "D1003", defaultTeamId: "t2" },
  { id: "p4", firstName: "Riley", lastName: "Parker", email: "riley@example.com", duprId: "D1004", defaultTeamId: "t2" },
  { id: "p5", firstName: "Blake", lastName: "Thomas", email: "blake@example.com", duprId: "D1005", defaultTeamId: "t3" },
  { id: "p6", firstName: "Morgan", lastName: "Singh", email: "morgan@example.com", duprId: "D1006", defaultTeamId: "t3" },
  { id: "p7", firstName: "Quinn", lastName: "Hall", email: "quinn@example.com", duprId: "D1007", defaultTeamId: "t4" },
  { id: "p8", firstName: "Taylor", lastName: "Brooks", email: "taylor@example.com", duprId: "D1008", defaultTeamId: "t4" }
];

const initialMatches: Match[] = [
  {
    id: "m1",
    leagueId: "l1",
    date: "2026-05-01",
    teamAId: "t1",
    teamBId: "t2",
    teamAPlayers: ["p1", "p2"],
    teamBPlayers: ["p3", "p4"],
    scoreA: 11,
    scoreB: 8
  },
  {
    id: "m2",
    leagueId: "l2",
    date: "2026-05-01",
    teamAId: "t3",
    teamBId: "t4",
    teamAPlayers: ["p5", "p6"],
    teamBPlayers: ["p7", "p8"],
    scoreA: 9,
    scoreB: 11
  },
  {
    id: "m3",
    leagueId: "l1",
    date: "2026-05-03",
    teamAId: "t1",
    teamBId: "t2",
    teamAPlayers: ["p1", "p4"],
    teamBPlayers: ["p2", "p3"],
    scoreA: 11,
    scoreB: 7
  }
];

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

const safeCsvCell = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

const rowFromEntry = (id: string, name: string): StatsRow => ({
  id,
  name,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  differential: 0,
  winRate: 0
});

function App() {
  const [persona, setPersona] = useState<Persona>("user");

  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [matches, setMatches] = useState<Match[]>(initialMatches);

  const [playerForm, setPlayerForm] = useState<PlayerForm>({ ...emptyPlayerForm, defaultTeamId: initialTeams[0]?.id ?? "" });
  const [teamForm, setTeamForm] = useState<TeamForm>({ ...emptyTeamForm, leagueId: initialLeagues[0]?.id ?? "" });
  const [leagueForm, setLeagueForm] = useState<LeagueForm>({ ...emptyLeagueForm });

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);

  const [matchForm, setMatchForm] = useState<MatchForm>({
    leagueId: initialLeagues[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    teamAId: initialTeams[0]?.id ?? "",
    teamBId: initialTeams[1]?.id ?? "",
    teamAPlayer1: initialPlayers[0]?.id ?? "",
    teamAPlayer2: initialPlayers[1]?.id ?? "",
    teamBPlayer1: initialPlayers[2]?.id ?? "",
    teamBPlayer2: initialPlayers[3]?.id ?? "",
    scoreA: "11",
    scoreB: "8"
  });

  const [matchError, setMatchError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [csvDate, setCsvDate] = useState(new Date().toISOString().slice(0, 10));

  const playerNameById = useMemo(() => {
    return new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  }, [players]);

  const teamNameById = useMemo(() => {
    return new Map(teams.map((t) => [t.id, t.name]));
  }, [teams]);

  const leagueNameById = useMemo(() => {
    return new Map(leagues.map((l) => [l.id, `${l.name} (${l.season})`]));
  }, [leagues]);

  const withRates = (rows: StatsRow[]): StatsRow[] => {
    const hydrated = rows.map((row) => ({
      ...row,
      differential: row.pointsFor - row.pointsAgainst,
      winRate: row.gamesPlayed ? row.wins / row.gamesPlayed : 0
    }));

    hydrated.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.differential - a.differential;
    });

    return hydrated;
  };

  const playerStats = useMemo<StatsRow[]>(() => {
    const byId = new Map(players.map((p) => [p.id, rowFromEntry(p.id, `${p.firstName} ${p.lastName}`)]));

    for (const match of matches) {
      const winners = match.scoreA > match.scoreB ? match.teamAPlayers : match.teamBPlayers;

      for (const playerId of match.teamAPlayers) {
        const row = byId.get(playerId);
        if (!row) continue;
        row.gamesPlayed += 1;
        row.pointsFor += match.scoreA;
        row.pointsAgainst += match.scoreB;
        if (winners.includes(playerId)) row.wins += 1;
        else row.losses += 1;
      }

      for (const playerId of match.teamBPlayers) {
        const row = byId.get(playerId);
        if (!row) continue;
        row.gamesPlayed += 1;
        row.pointsFor += match.scoreB;
        row.pointsAgainst += match.scoreA;
        if (winners.includes(playerId)) row.wins += 1;
        else row.losses += 1;
      }
    }

    return withRates(Array.from(byId.values()));
  }, [players, matches]);

  const teamStats = useMemo<StatsRow[]>(() => {
    const byId = new Map(teams.map((t) => [t.id, rowFromEntry(t.id, t.name)]));

    for (const match of matches) {
      const teamAWon = match.scoreA > match.scoreB;

      const teamA = byId.get(match.teamAId);
      if (teamA) {
        teamA.gamesPlayed += 1;
        teamA.pointsFor += match.scoreA;
        teamA.pointsAgainst += match.scoreB;
        if (teamAWon) teamA.wins += 1;
        else teamA.losses += 1;
      }

      const teamB = byId.get(match.teamBId);
      if (teamB) {
        teamB.gamesPlayed += 1;
        teamB.pointsFor += match.scoreB;
        teamB.pointsAgainst += match.scoreA;
        if (!teamAWon) teamB.wins += 1;
        else teamB.losses += 1;
      }
    }

    return withRates(Array.from(byId.values()));
  }, [teams, matches]);

  const leagueStats = useMemo<StatsRow[]>(() => {
    const byId = new Map(leagues.map((l) => [l.id, rowFromEntry(l.id, `${l.name} ${l.season}`)]));

    for (const match of matches) {
      const league = byId.get(match.leagueId);
      if (!league) continue;
      league.gamesPlayed += 1;
      league.pointsFor += match.scoreA + match.scoreB;
      if (match.scoreA > match.scoreB) league.wins += 1;
      else league.losses += 1;
    }

    return withRates(Array.from(byId.values()));
  }, [leagues, matches]);

  const totalMatches = matches.length;
  const totalPlayers = players.length;
  const totalTeams = teams.length;

  const onSavePlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Player = { id: editingPlayerId ?? `p${Date.now()}`, ...playerForm };

    if (editingPlayerId) {
      setPlayers((prev) => prev.map((player) => (player.id === editingPlayerId ? next : player)));
      setAdminMessage("Player updated.");
    } else {
      setPlayers((prev) => [next, ...prev]);
      setAdminMessage("Player created.");
    }

    setEditingPlayerId(null);
    setPlayerForm({ ...emptyPlayerForm, defaultTeamId: teams[0]?.id ?? "" });
  };

  const onSaveTeam = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Team = { id: editingTeamId ?? `t${Date.now()}`, ...teamForm };

    if (editingTeamId) {
      setTeams((prev) => prev.map((team) => (team.id === editingTeamId ? next : team)));
      setAdminMessage("Team updated.");
    } else {
      setTeams((prev) => [next, ...prev]);
      setAdminMessage("Team created.");
    }

    setEditingTeamId(null);
    setTeamForm({ ...emptyTeamForm, leagueId: leagues[0]?.id ?? "" });
  };

  const onSaveLeague = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: League = { id: editingLeagueId ?? `l${Date.now()}`, ...leagueForm };

    if (editingLeagueId) {
      setLeagues((prev) => prev.map((league) => (league.id === editingLeagueId ? next : league)));
      setAdminMessage("League updated.");
    } else {
      setLeagues((prev) => [next, ...prev]);
      setAdminMessage("League created.");
    }

    setEditingLeagueId(null);
    setLeagueForm({ ...emptyLeagueForm });
  };

  const onDeletePlayer = (playerId: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    setMatches((prev) => prev.filter((match) => !match.teamAPlayers.includes(playerId) && !match.teamBPlayers.includes(playerId)));
    setAdminMessage("Player removed. Matches containing this player were removed too.");
  };

  const onDeleteTeam = (teamId: string) => {
    setTeams((prev) => prev.filter((team) => team.id !== teamId));
    setPlayers((prev) => prev.map((player) => (player.defaultTeamId === teamId ? { ...player, defaultTeamId: "" } : player)));
    setMatches((prev) => prev.filter((match) => match.teamAId !== teamId && match.teamBId !== teamId));
    setAdminMessage("Team removed. Related matches were removed.");
  };

  const onDeleteLeague = (leagueId: string) => {
    setLeagues((prev) => prev.filter((league) => league.id !== leagueId));
    const removedTeamIds = new Set(teams.filter((team) => team.leagueId === leagueId).map((team) => team.id));
    setTeams((prev) => prev.filter((team) => team.leagueId !== leagueId));
    setPlayers((prev) => prev.map((player) => (removedTeamIds.has(player.defaultTeamId) ? { ...player, defaultTeamId: "" } : player)));
    setMatches((prev) => prev.filter((match) => match.leagueId !== leagueId));
    setAdminMessage("League removed. Child teams and matches were removed.");
  };

  const onRecordMatch = (event: FormEvent<HTMLFormElement>) => {
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

    const nextMatch: Match = {
      id: `m${Date.now()}`,
      leagueId: matchForm.leagueId,
      date: matchForm.date,
      teamAId: matchForm.teamAId,
      teamBId: matchForm.teamBId,
      teamAPlayers: [matchForm.teamAPlayer1, matchForm.teamAPlayer2],
      teamBPlayers: [matchForm.teamBPlayer1, matchForm.teamBPlayer2],
      scoreA,
      scoreB
    };

    setMatches((prev) => [nextMatch, ...prev]);
    setAdminMessage("Match result recorded.");
  };

  const exportMatchesForDay = () => {
    const filtered = matches.filter((m) => m.date === csvDate);
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

    const rows = filtered.map((match) => {
      const winner = match.scoreA > match.scoreB ? teamNameById.get(match.teamAId) ?? "" : teamNameById.get(match.teamBId) ?? "";
      return [
        match.date,
        leagueNameById.get(match.leagueId) ?? "",
        teamNameById.get(match.teamAId) ?? "",
        playerNameById.get(match.teamAPlayers[0]) ?? "",
        playerNameById.get(match.teamAPlayers[1]) ?? "",
        String(match.scoreA),
        teamNameById.get(match.teamBId) ?? "",
        playerNameById.get(match.teamBPlayers[0]) ?? "",
        playerNameById.get(match.teamBPlayers[1]) ?? "",
        String(match.scoreB),
        winner
      ];
    });

    const csv = [header, ...rows].map((line) => line.map((cell) => safeCsvCell(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hwpl-dupr-export-${csvDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setAdminMessage(`Exported ${rows.length} match(es) for ${csvDate}.`);
  };

  const recentMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

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

        <div className="hero-metrics">
          <article>
            <h2>{totalMatches}</h2>
            <p>Matches</p>
          </article>
          <article>
            <h2>{totalPlayers}</h2>
            <p>Players</p>
          </article>
          <article>
            <h2>{totalTeams}</h2>
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
                  <td>{row.name}</td>
                  <td>{row.gamesPlayed}</td>
                  <td>{row.gamesPlayed ? (row.pointsFor / row.gamesPlayed).toFixed(1) : "0.0"}</td>
                  <td>{leagues.find((league) => league.id === row.id)?.isActive ? "Yes" : "No"}</td>
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
              <strong>{teamNameById.get(match.teamAId) ?? "Unknown Team"}</strong>
              <em>{match.scoreA}</em>
              <em>{match.scoreB}</em>
              <strong>{teamNameById.get(match.teamBId) ?? "Unknown Team"}</strong>
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
