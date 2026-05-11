import { useCallback, useEffect, useMemo, useState } from "react";
import { LeagueStatRow, RecentMatch, StatsRow } from "./types";

function App() {
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [playerStats, setPlayerStats] = useState<StatsRow[]>([]);
  const [teamStats, setTeamStats] = useState<StatsRow[]>([]);
  const [leagueStats, setLeagueStats] = useState<LeagueStatRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  const loadStats = useCallback(async () => {
    const [psRes, tsRes, lsRes, rmRes] = await Promise.all([
      fetch("/api/stats/players"),
      fetch("/api/stats/teams"),
      fetch("/api/stats/leagues"),
      fetch("/api/stats/matches")
    ]);

    if (!psRes.ok || !tsRes.ok || !lsRes.ok || !rmRes.ok) {
      throw new Error("Failed to load stats");
    }

    const [ps, ts, ls, rm] = await Promise.all([
      psRes.json() as Promise<StatsRow[]>,
      tsRes.json() as Promise<StatsRow[]>,
      lsRes.json() as Promise<LeagueStatRow[]>,
      rmRes.json() as Promise<RecentMatch[]>
    ]);

    setPlayerStats(ps);
    setTeamStats(ts);
    setLeagueStats(ls);
    setRecentMatches(rm);
  }, []);

  useEffect(() => {
    setLoading(true);
    setApiError(null);
    loadStats()
      .catch(() => setApiError("Could not reach the API. Verify deployment and SQL connection settings."))
      .finally(() => setLoading(false));
  }, [loadStats]);

  const totalMatches = useMemo(() => leagueStats.reduce((sum, l) => sum + l.matches, 0), [leagueStats]);
  const totalPlayers = playerStats.length;
  const totalTeams = teamStats.length;

  const sortedLeagueStats = useMemo(
    () => [...leagueStats].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [leagueStats]
  );

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-brand-row">
          <img className="club-logo" src="/brand/HW PickleBall Logo.png" alt="Hiram Walker Pickleball Club logo" />
          <div>
            <p className="eyebrow">Hiram Walker Pickleball League</p>
            <h1>League Statistics Portal</h1>
          </div>
        </div>
        <p>View live league, team, player, and recent match statistics powered by the Azure backend.</p>

        {apiError ? <p className="panel status-msg" style={{ color: "#9a2f2f" }}>{apiError}</p> : null}

        <div className="hero-metrics">
          <article>
            <h2>{loading ? "..." : totalMatches}</h2>
            <p>Matches</p>
          </article>
          <article>
            <h2>{loading ? "..." : totalPlayers}</h2>
            <p>Players</p>
          </article>
          <article>
            <h2>{loading ? "..." : totalTeams}</h2>
            <p>Teams</p>
          </article>
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
          <p>Aggregated match totals by league, most recent first.</p>
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
              {sortedLeagueStats.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
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

      <footer className="panel admin-entry">
        <a className="admin-link" href="/.auth/login/aad?post_login_redirect_uri=/admin">
          Admin login
        </a>
      </footer>
    </main>
  );
}

export default App;
