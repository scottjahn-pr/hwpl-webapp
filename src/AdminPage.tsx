import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { League, Player, Team } from "./types";

interface AuthMeClaim {
  typ?: string;
  type?: string;
  val?: string;
  value?: string;
}

interface AuthMePrincipal {
  userId?: string;
  claims?: AuthMeClaim[];
}

interface AuthMeLegacyEntry {
  user_id?: string;
  user_claims?: AuthMeClaim[];
}

interface AuthMeCurrentEntry {
  clientPrincipal?: AuthMePrincipal;
}

interface DebugAuthResponse {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  objectId?: string;
  candidateIds?: string[];
  principalName?: string;
  roles?: string[];
  headerPresence?: {
    hasClientPrincipal?: boolean;
    hasClientPrincipalId?: boolean;
    hasClientPrincipalName?: boolean;
  };
}

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

const authFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return fetch(input, {
    ...init,
    credentials: "include"
  });
};

function AdminPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [entraObjectId, setEntraObjectId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [authDebug, setAuthDebug] = useState("");

  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

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

  const leagueNameById = useMemo(() => new Map(leagues.map((l) => [l.id, `${l.name} (${l.season})`])), [leagues]);

  const extractObjectId = (entry: AuthMeLegacyEntry | AuthMeCurrentEntry | undefined): string => {
    if (!entry) return "";

    const currentPrincipal = (entry as AuthMeCurrentEntry).clientPrincipal;
    if (currentPrincipal?.userId) return currentPrincipal.userId;

    const currentClaims = currentPrincipal?.claims ?? [];
    const currentOidClaim = currentClaims.find(
      (claim) =>
        claim.typ === "oid" ||
        claim.type === "oid" ||
        claim.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier"
        || claim.type === "http://schemas.microsoft.com/identity/claims/objectidentifier"
    );
    const currentOidValue = currentOidClaim?.val ?? currentOidClaim?.value;
    if (currentOidValue) return currentOidValue;

    const legacyEntry = entry as AuthMeLegacyEntry;
    if (legacyEntry.user_id) return legacyEntry.user_id;

    const claims = legacyEntry.user_claims ?? [];
    const oidClaim = claims.find(
      (claim) =>
        claim.typ === "oid" ||
        claim.type === "oid" ||
        claim.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier"
        || claim.type === "http://schemas.microsoft.com/identity/claims/objectidentifier"
    );

    return oidClaim?.val ?? oidClaim?.value ?? "";
  };

  const loadSignedInObjectId = useCallback(async (): Promise<string> => {
    try {
      const res = await authFetch("/.auth/me");
      if (!res.ok) {
        setEntraObjectId("");
        return "";
      }

      const data = (await res.json()) as Array<AuthMeLegacyEntry | AuthMeCurrentEntry>;
      const objectId = extractObjectId(data?.[0]);
      setEntraObjectId(objectId);
      return objectId;
    } catch {
      setEntraObjectId("");
      return "";
    }
  }, []);

  const loadAuthDebug = useCallback(async (): Promise<DebugAuthResponse> => {
    try {
      const res = await authFetch("/api/debug/auth");
      if (!res.ok) {
        setAuthDebug("");
        return {};
      }

      const payload = (await res.json()) as DebugAuthResponse;
      setAuthDebug(JSON.stringify(payload, null, 2));
      return payload;
    } catch {
      setAuthDebug("");
      return {};
    }
  }, []);

  const loadAdminData = useCallback(async (): Promise<void> => {
    const [lRes, tRes, pRes] = await Promise.all([
      authFetch("/api/admin/leagues"),
      authFetch("/api/admin/teams"),
      authFetch("/api/admin/players")
    ]);

    if ([lRes, tRes, pRes].some((res) => res.status === 401 || res.status === 403)) {
      const statusSummary = `leagues=${lRes.status}, teams=${tRes.status}, players=${pRes.status}`;
      setAdminMessage(`Signed in as admin, but one or more admin data endpoints were denied (${statusSummary}).`);
      return;
    }

    if (!lRes.ok || !tRes.ok || !pRes.ok) {
      const statusSummary = `leagues=${lRes.status}, teams=${tRes.status}, players=${pRes.status}`;
      setAdminMessage(`Signed in as admin, but failed to load admin data (${statusSummary}).`);
      return;
    }

    const loadedLeagues: League[] = await lRes.json();
    const loadedTeams: Team[] = await tRes.json();
    const loadedPlayers: Player[] = await pRes.json();

    setLeagues(loadedLeagues);
    setTeams(loadedTeams);
    setPlayers(loadedPlayers);

    setPlayerForm((prev) => ({ ...prev, defaultTeamId: prev.defaultTeamId || loadedTeams[0]?.id || "" }));
    setTeamForm((prev) => ({ ...prev, leagueId: prev.leagueId || loadedLeagues[0]?.id || "" }));
    setMatchForm((prev) => ({
      ...prev,
      leagueId: prev.leagueId || loadedLeagues[0]?.id || "",
      teamAId: prev.teamAId || loadedTeams[0]?.id || "",
      teamBId: prev.teamBId || loadedTeams[1]?.id || loadedTeams[0]?.id || "",
      teamAPlayer1: prev.teamAPlayer1 || loadedPlayers[0]?.id || "",
      teamAPlayer2: prev.teamAPlayer2 || loadedPlayers[1]?.id || "",
      teamBPlayer1: prev.teamBPlayer1 || loadedPlayers[2]?.id || "",
      teamBPlayer2: prev.teamBPlayer2 || loadedPlayers[3]?.id || ""
    }));
  }, []);

  const checkAuthorization = useCallback(async () => {
    setAuthLoading(true);
    try {
      const debug = await loadAuthDebug();

      if (!debug.isAuthenticated) {
        setIsAuthorized(false);
        setAuthMessage("Please sign in with Microsoft Entra ID to access admin tools.");
        await loadSignedInObjectId();
      } else if (debug.isAdmin) {
        setIsAuthorized(true);
        setAuthMessage("");
        if (debug.objectId) {
          setEntraObjectId(debug.objectId);
        } else if (debug.candidateIds?.length) {
          setEntraObjectId(debug.candidateIds[0]);
        } else {
          await loadSignedInObjectId();
        }
        await loadAdminData();
      } else {
        setIsAuthorized(false);
        setAuthMessage("Your account is signed in, but not approved for admin access.");
        if (debug.objectId) {
          setEntraObjectId(debug.objectId);
        } else if (debug.candidateIds?.length) {
          setEntraObjectId(debug.candidateIds[0]);
        } else {
          await loadSignedInObjectId();
        }
      }
    } catch (error) {
      setIsAuthorized(false);
      setAuthMessage("Could not validate admin session. Try refreshing.");
      setAdminMessage(error instanceof Error ? error.message : "Failed to validate admin session.");
    } finally {
      setAuthLoading(false);
    }
  }, [loadAdminData, loadAuthDebug, loadSignedInObjectId]);

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  const copyObjectId = async () => {
    if (!entraObjectId) return;

    try {
      await navigator.clipboard.writeText(entraObjectId);
      setCopyMessage("Object ID copied.");
    } catch {
      setCopyMessage("Unable to copy automatically. Please copy manually.");
    }
  };

  const onSavePlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const res = await authFetch(editingPlayerId ? `/api/admin/players/${editingPlayerId}` : "/api/admin/players", {
        method: editingPlayerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingPlayerId ? "Player updated." : "Player added.");
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
      const res = await authFetch(editingTeamId ? `/api/admin/teams/${editingTeamId}` : "/api/admin/teams", {
        method: editingTeamId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingTeamId ? "Team updated." : "Team added.");
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
      const res = await authFetch(editingLeagueId ? `/api/admin/leagues/${editingLeagueId}` : "/api/admin/leagues", {
        method: editingLeagueId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leagueForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingLeagueId ? "League updated." : "League added.");
      setEditingLeagueId(null);
      setLeagueForm({ ...emptyLeagueForm });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving league.");
    }
  };

  const onDeletePlayer = async (playerId: string) => {
    try {
      const res = await authFetch(`/api/admin/players/${playerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setAdminMessage("Player removed.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error removing player.");
    }
  };

  const onDeleteTeam = async (teamId: string) => {
    try {
      const res = await authFetch(`/api/admin/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setAdminMessage("Team removed.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error removing team.");
    }
  };

  const onDeleteLeague = async (leagueId: string) => {
    try {
      const res = await authFetch(`/api/admin/leagues/${leagueId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setAdminMessage("League removed.");
      await loadAdminData();
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
      const res = await authFetch("/api/admin/matches", {
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
    } catch {
      setMatchError("Network error recording match.");
    }
  };

  const exportMatchesForDay = async () => {
    try {
      const res = await authFetch(`/api/exports/dupr?date=${csvDate}`);
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

  if (authLoading) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h3>Checking Admin Access</h3>
          <p>Validating your Microsoft Entra sign-in...</p>
        </section>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h3>Admin Access Required</h3>
          <p>{authMessage}</p>
          <div className="admin-identity-box">
            <h4>Who Am I</h4>
            <p>Use this Entra Object ID in ADMIN_ENTRA_OBJECT_IDS to grant admin access.</p>
            <div className="admin-identity-row">
              <code>{entraObjectId || "Sign in to view your Entra Object ID"}</code>
              <button type="button" onClick={copyObjectId} disabled={!entraObjectId}>
                Copy ID
              </button>
            </div>
            {copyMessage ? <p className="status-msg">{copyMessage}</p> : null}
            {authDebug ? <pre className="auth-debug">{authDebug}</pre> : null}
          </div>
          <div className="admin-auth-links">
            <a className="admin-link" href="/.auth/login/aad?post_login_redirect_uri=/admin">Sign in with Entra ID</a>
            <a className="admin-link" href="/">Back to public stats</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-brand-row">
          <img className="club-logo" src="/brand/HW PickleBall Logo.png" alt="Hiram Walker Pickleball Club logo" />
          <div>
            <p className="eyebrow">HWPL Administration</p>
            <h1>League Management</h1>
          </div>
        </div>
        <p>Manage players, teams, leagues, match entries, and exports.</p>
        <div className="admin-auth-links admin-auth-links-hero">
          <a className="admin-link" href="/">Public stats</a>
          <a className="admin-link" href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a>
        </div>
        <div className="admin-identity-box admin-identity-box-hero">
          <h4>Who Am I</h4>
          <p>Your Entra Object ID (for admin allowlist):</p>
          <div className="admin-identity-row">
            <code>{entraObjectId || "Sign in to view your Entra Object ID"}</code>
            <button type="button" onClick={copyObjectId} disabled={!entraObjectId}>
              Copy ID
            </button>
          </div>
          {copyMessage ? <p className="status-msg">{copyMessage}</p> : null}
        </div>
      </section>

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
            <p>Exports all matches for one day.</p>
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

      {adminMessage ? <p className="panel status-msg">{adminMessage}</p> : null}
    </main>
  );
}

export default AdminPage;
