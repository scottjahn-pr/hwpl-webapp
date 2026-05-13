import { useCallback, useEffect, useState } from "react";
import { RecentMatch, SessionCourtEntry, StatsRow } from "./types";

function App() {
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [playerStats, setPlayerStats] = useState<StatsRow[]>([]);
  const [teamStats, setTeamStats] = useState<StatsRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sessionData, setSessionData] = useState<SessionCourtEntry[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    const [psRes, tsRes, rmRes, sdRes] = await Promise.all([
      fetch("/api/stats/players"),
      fetch("/api/stats/teams"),
      fetch("/api/stats/matches"),
      fetch("/api/stats/session-dates")
    ]);

    if (!psRes.ok || !tsRes.ok || !rmRes.ok || !sdRes.ok) {
      throw new Error("Failed to load stats");
    }

    const [ps, ts, rm, sd] = await Promise.all([
      psRes.json() as Promise<StatsRow[]>,
      tsRes.json() as Promise<StatsRow[]>,
      rmRes.json() as Promise<RecentMatch[]>,
      sdRes.json() as Promise<string[]>
    ]);

    setPlayerStats(ps);
    setTeamStats(ts);
    setRecentMatches(rm);
    setSessionDates(sd);
    if (sd.length > 0) setSelectedDate(sd[0]);
  }, []);

  useEffect(() => {
    setLoading(true);
    setApiError(null);
    loadStats()
      .catch(() => setApiError("Could not reach the API. Verify deployment and SQL connection settings."))
      .finally(() => setLoading(false));
  }, [loadStats]);

  useEffect(() => {
    if (!selectedDate) return;
    setSessionLoading(true);
    fetch(`/api/stats/session?date=${encodeURIComponent(selectedDate)}`)
      .then(r => r.ok ? r.json() as Promise<SessionCourtEntry[]> : Promise.reject())
      .then(data => setSessionData(data))
      .catch(() => setSessionData([]))
      .finally(() => setSessionLoading(false));
  }, [selectedDate]);

  const totalPlayers = playerStats.length;
  const totalTeams = teamStats.length;
  const totalSessions = sessionDates.length;

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
        <p>View live league, team, player, and recent match statistics.</p>

        {apiError ? <p className="panel status-msg" style={{ color: "#9a2f2f" }}>{apiError}</p> : null}

        <div className="hero-metrics">
          <article>
            <h2>{loading ? "..." : totalSessions}</h2>
            <p>Sessions</p>
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
          <h3>Session Summary</h3>
          <p>Match results by court for a selected play date.</p>
        </div>
        {sessionDates.length > 0 ? (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="session-date-select" style={{ marginRight: "0.5rem", fontWeight: 600 }}>Session date:</label>
              <select
                id="session-date-select"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              >
                {sessionDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {sessionLoading ? (
              <p>Loading session data...</p>
            ) : sessionData.length === 0 ? (
              <p>No match data for this date.</p>
            ) : (
              sessionData.map(court => (
                <div key={court.courtId} style={{ marginBottom: "1.5rem" }}>
                  <h4 style={{ marginBottom: "0.5rem" }}>{court.courtName}</h4>
                  {court.doubles.length > 0 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Doubles — Team Stats</p>
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
                            {court.doubles.map(row => (
                              <tr key={row.teamId}>
                                <td>{row.teamName}</td>
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
                    </div>
                  )}
                  {court.ladder.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Ladder — Player Stats</p>
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
                            {court.ladder.map(row => (
                              <tr key={row.playerId}>
                                <td>{row.playerName}</td>
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
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          <p>{loading ? "Loading..." : "No sessions recorded yet."}</p>
        )}
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
