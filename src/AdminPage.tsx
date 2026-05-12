import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Court, League, Player, Team } from "./types";

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

interface ManagedMatch {
  id: string;
  leagueId: string;
  courtId: string;
  courtName: string;
  scoringType: "Standard" | "Rally";
  gameType: "Doubles" | "Ladder";
  date: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  leagueName: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
  teamAPlayerNames: [string, string];
  teamBPlayerNames: [string, string];
}

type PlayerForm = {
  firstName: string;
  lastName: string;
  duprId: string;
  defaultTeamId: string;
  isActive: boolean;
};
type TeamForm = { name: string; leagueIds: string[]; isActive: boolean };
type LeagueForm = Omit<League, "id">;
type CourtForm = Omit<Court, "id">;

interface MatchForm {
  leagueId: string;
  courtId: string;
  scoringType: "Standard" | "Rally";
  gameType: "Doubles" | "Ladder";
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
  duprId: "",
  defaultTeamId: "",
  isActive: true
};

const emptyTeamForm: TeamForm = {
  name: "",
  leagueIds: [],
  isActive: true
};

const emptyLeagueForm: LeagueForm = {
  name: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  isActive: true
};

const emptyCourtForm: CourtForm = {
  name: "",
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
  const [courts, setCourts] = useState<Court[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<ManagedMatch[]>([]);

  const [playerForm, setPlayerForm] = useState<PlayerForm>({ ...emptyPlayerForm });
  const [teamForm, setTeamForm] = useState<TeamForm>({ ...emptyTeamForm });
  const [leagueForm, setLeagueForm] = useState<LeagueForm>({ ...emptyLeagueForm });
  const [courtForm, setCourtForm] = useState<CourtForm>({ ...emptyCourtForm });

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const editingTeamIdRef = useRef<string | null>(null);
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const [matchForm, setMatchForm] = useState<MatchForm>({
    leagueId: "",
    courtId: "",
    scoringType: "Standard",
    gameType: "Doubles",
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
  const [adminApiBase, setAdminApiBase] = useState("/api/ops");

  useEffect(() => { editingTeamIdRef.current = editingTeamId; }, [editingTeamId]);

  const activeLeagues = useMemo(() => leagues.filter((league) => league.isActive), [leagues]);
  const activeCourts = useMemo(() => courts.filter((court) => court.isActive), [courts]);
  const activeTeams = useMemo(() => teams.filter((team) => team.isActive), [teams]);
  const activePlayers = useMemo(() => players.filter((player) => player.isActive), [players]);

  const getAvailablePlayersForSlot = (slot: "teamAPlayer1" | "teamAPlayer2" | "teamBPlayer1" | "teamBPlayer2") => {
    const selected = {
      teamAPlayer1: matchForm.teamAPlayer1,
      teamAPlayer2: matchForm.teamAPlayer2,
      teamBPlayer1: matchForm.teamBPlayer1,
      teamBPlayer2: matchForm.teamBPlayer2
    };

    const taken = new Set(
      Object.entries(selected)
        .filter(([key, value]) => key !== slot && Boolean(value))
        .map(([, value]) => value)
    );

    return activePlayers.filter((player) => !taken.has(player.id) || player.id === selected[slot]);
  };

  const getPreferredPlayerPairForTeam = (teamId: string, excludedIds: string[]): [string, string] => {
    const excluded = new Set(excludedIds.filter(Boolean));
    const teamDefaults = activePlayers
      .filter((player) => player.defaultTeamId === teamId)
      .map((player) => player.id)
      .filter((id) => !excluded.has(id));
    const fallback = activePlayers
      .map((player) => player.id)
      .filter((id) => !excluded.has(id) && !teamDefaults.includes(id));
    const candidates = [...teamDefaults, ...fallback];
    return [candidates[0] ?? "", candidates[1] ?? ""];
  };

  const formatLeagueDates = (league: Pick<League, "startDate" | "endDate">) => `${league.startDate} to ${league.endDate}`;

  const leagueNameById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l.name])),
    [leagues]
  );

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
    let base = adminApiBase;
    let [lRes, cRes, tRes, pRes, mRes] = await Promise.all([
      authFetch(`${base}/leagues`),
      authFetch(`${base}/courts`),
      authFetch(`${base}/teams`),
      authFetch(`${base}/players`),
      authFetch(`${base}/matches`)
    ]);

    // If all collection endpoints are missing, try the alternate namespace.
    if ([lRes, cRes, tRes, pRes, mRes].every((res) => res.status === 404)) {
      base = base === "/api/ops" ? "/api/admin" : "/api/ops";
      [lRes, cRes, tRes, pRes, mRes] = await Promise.all([
        authFetch(`${base}/leagues`),
        authFetch(`${base}/courts`),
        authFetch(`${base}/teams`),
        authFetch(`${base}/players`),
        authFetch(`${base}/matches`)
      ]);
      setAdminApiBase(base);
    }

    if ([lRes, cRes, tRes, pRes, mRes].some((res) => res.status === 401 || res.status === 403)) {
      const statusSummary = `leagues=${lRes.status}, courts=${cRes.status}, teams=${tRes.status}, players=${pRes.status}, matches=${mRes.status}`;
      setAdminMessage(`Signed in as admin, but one or more admin data endpoints were denied (${statusSummary}) via ${base}.`);
      return;
    }

    if (!lRes.ok || !cRes.ok || !tRes.ok || !pRes.ok || !mRes.ok) {
      const statusSummary = `leagues=${lRes.status}, courts=${cRes.status}, teams=${tRes.status}, players=${pRes.status}, matches=${mRes.status}`;
      setAdminMessage(`Signed in as admin, but failed to load admin data (${statusSummary}) via ${base}.`);
      return;
    }

    const loadedLeagues: League[] = await lRes.json();
    const loadedCourts: Court[] = await cRes.json();
    const loadedTeams: Team[] = await tRes.json();
    const loadedPlayers: Player[] = await pRes.json();
    const loadedMatches: ManagedMatch[] = await mRes.json();

    setLeagues(loadedLeagues);
    setCourts(loadedCourts);
    setTeams(loadedTeams);
    setPlayers(loadedPlayers);
    setMatches(loadedMatches);

    const activeLoadedLeagues = loadedLeagues.filter((league) => league.isActive);
    const activeLoadedCourts = loadedCourts.filter((court) => court.isActive);

    if (!editingTeamIdRef.current) {
      const activeLoadedLeagueIds = activeLoadedLeagues.map((l) => l.id);
      setTeamForm((prev) => ({ ...prev, leagueIds: activeLoadedLeagueIds }));
    }

    setMatchForm((prev) => ({
      ...prev,
      leagueId: prev.leagueId || activeLoadedLeagues[0]?.id || "",
      courtId: prev.courtId || activeLoadedCourts[0]?.id || ""
    }));
  }, [adminApiBase]);

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
      const res = await authFetch(editingPlayerId ? `${adminApiBase}/players/${editingPlayerId}` : `${adminApiBase}/players`, {
        method: editingPlayerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingPlayerId ? "Player updated." : "Player added.");
      setEditingPlayerId(null);
      setPlayerForm({ ...emptyPlayerForm });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving player.");
    }
  };

  const onSaveTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const res = await authFetch(editingTeamId ? `${adminApiBase}/teams/${editingTeamId}` : `${adminApiBase}/teams`, {
        method: editingTeamId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingTeamId ? "Team updated." : "Team added.");
      setEditingTeamId(null);
      setTeamForm({ ...emptyTeamForm });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving team.");
    }
  };

  const onSaveLeague = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leagueForm.endDate) {
      setAdminMessage("League end date is required.");
      return;
    }

    if (leagueForm.endDate < leagueForm.startDate) {
      setAdminMessage("League end date cannot be before start date.");
      return;
    }

    try {
      const res = await authFetch(editingLeagueId ? `${adminApiBase}/leagues/${editingLeagueId}` : `${adminApiBase}/leagues`, {
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

  const onSaveCourt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const res = await authFetch(editingCourtId ? `${adminApiBase}/courts/${editingCourtId}` : `${adminApiBase}/courts`, {
        method: editingCourtId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courtForm)
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(editingCourtId ? "Court updated." : "Court added.");
      setEditingCourtId(null);
      setCourtForm({ ...emptyCourtForm });
      await loadAdminData();
    } catch {
      setAdminMessage("Error saving court.");
    }
  };

  const onTogglePlayerActive = async (player: Player) => {
    try {
      const res = await authFetch(`${adminApiBase}/players/${player.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: player.firstName,
          lastName: player.lastName,
          duprId: player.duprId,
          defaultTeamId: player.defaultTeamId,
          isActive: !player.isActive
        })
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(player.isActive ? "Player deactivated." : "Player activated.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error updating player status.");
    }
  };

  const onToggleTeamActive = async (team: Team) => {
    try {
      const res = await authFetch(`${adminApiBase}/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: team.name,
          leagueIds: team.leagueIds,
          isActive: !team.isActive
        })
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(team.isActive ? "Team deactivated." : "Team activated.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error updating team status.");
    }
  };

  const onToggleLeagueActive = async (league: League) => {
    try {
      const res = await authFetch(`${adminApiBase}/leagues/${league.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: league.name,
          startDate: league.startDate,
          endDate: league.endDate,
          isActive: !league.isActive
        })
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(league.isActive ? "League deactivated." : "League activated.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error updating league status.");
    }
  };

  const onToggleCourtActive = async (court: Court) => {
    try {
      const res = await authFetch(`${adminApiBase}/courts/${court.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: court.name,
          isActive: !court.isActive
        })
      });
      if (!res.ok) throw new Error("failed");
      setAdminMessage(court.isActive ? "Court deactivated." : "Court activated.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error updating court status.");
    }
  };

  const onEditMatch = (match: ManagedMatch) => {
    setEditingMatchId(match.id);
    setMatchForm({
      leagueId: match.leagueId,
      courtId: match.courtId,
      scoringType: match.scoringType,
      gameType: match.gameType,
      date: match.date,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      teamAPlayer1: match.teamAPlayers[0],
      teamAPlayer2: match.teamAPlayers[1],
      teamBPlayer1: match.teamBPlayers[0],
      teamBPlayer2: match.teamBPlayers[1],
      scoreA: String(match.scoreA),
      scoreB: String(match.scoreB)
    });
    setAdminMessage(`Editing match from ${match.date}. Save to apply updates.`);
  };

  const onCancelMatchEdit = () => {
    setEditingMatchId(null);
    setMatchForm((prev) => ({ ...prev, scoreA: "11", scoreB: "8" }));
  };

  const onDeleteMatch = async (matchId: string) => {
    try {
      const res = await authFetch(`${adminApiBase}/matches/${matchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      if (editingMatchId === matchId) {
        setEditingMatchId(null);
      }
      setAdminMessage("Match deleted.");
      await loadAdminData();
    } catch {
      setAdminMessage("Error deleting match.");
    }
  };

  const onRecordMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMatchError("");

    if (!matchForm.courtId) {
      setMatchError("Please select a court.");
      return;
    }

    if (matchForm.gameType === "Doubles" && (!matchForm.teamAId || !matchForm.teamBId)) {
      setMatchError("Please select both teams.");
      return;
    }

    const pickedPlayersEarly = [matchForm.teamAPlayer1, matchForm.teamAPlayer2, matchForm.teamBPlayer1, matchForm.teamBPlayer2];
    if (pickedPlayersEarly.some((id) => !id)) {
      setMatchError("Please select all four players.");
      return;
    }

    if (matchForm.gameType === "Doubles" && matchForm.teamAId === matchForm.teamBId) {
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
      const res = await authFetch(editingMatchId ? `${adminApiBase}/matches/${editingMatchId}` : `${adminApiBase}/matches`, {
        method: editingMatchId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: matchForm.leagueId,
          courtId: matchForm.courtId,
          scoringType: matchForm.scoringType,
          gameType: matchForm.gameType,
          date: matchForm.date,
          teamAId: matchForm.gameType === "Doubles" ? matchForm.teamAId : null,
          teamBId: matchForm.gameType === "Doubles" ? matchForm.teamBId : null,
          teamAPlayers: [matchForm.teamAPlayer1, matchForm.teamAPlayer2],
          teamBPlayers: [matchForm.teamBPlayer1, matchForm.teamBPlayer2],
          scoreA,
          scoreB
        })
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let parsed: { message?: string; error?: string } | null = null;

        if (raw) {
          try {
            parsed = JSON.parse(raw) as { message?: string; error?: string };
          } catch {
            parsed = null;
          }
        }

        const normalizedRaw = raw.trim();
        const fallbackText = normalizedRaw && !normalizedRaw.startsWith("<") ? normalizedRaw : "";
        setMatchError(parsed?.error ?? parsed?.message ?? fallbackText ?? "Failed to record match.");
        return;
      }

      setEditingMatchId(null);
      setAdminMessage(editingMatchId ? "Match updated." : "Match result recorded.");
      await loadAdminData();
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
      </section>

      <section className="admin-grid">
        <article className="panel module-record-match">
          <div className="panel-header">
            <h3>Record Match Result</h3>
            <p>Admins can add individual match outcomes.</p>
          </div>
          <form className="match-form" onSubmit={onRecordMatch}>
            <label>
              League
              <select value={matchForm.leagueId} onChange={(e) => setMatchForm((prev) => ({ ...prev, leagueId: e.target.value }))} required>
                {activeLeagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Court
              <select value={matchForm.courtId} onChange={(e) => setMatchForm((prev) => ({ ...prev, courtId: e.target.value }))} required>
                {activeCourts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="teams-grid">
              <label>
                Scoring Type
                <select value={matchForm.scoringType} onChange={(e) => setMatchForm((prev) => ({ ...prev, scoringType: e.target.value as "Standard" | "Rally" }))}>
                  <option value="Standard">Standard</option>
                  <option value="Rally">Rally</option>
                </select>
              </label>
              <label>
                Game Type
                <select
                  value={matchForm.gameType}
                  onChange={(e) => {
                    const nextGameType = e.target.value as "Doubles" | "Ladder";
                    setMatchForm((prev) => ({
                      ...prev,
                      gameType: nextGameType,
                      teamAId: nextGameType === "Ladder" ? "" : prev.teamAId,
                      teamBId: nextGameType === "Ladder" ? "" : prev.teamBId,
                      ...(nextGameType === "Ladder"
                        ? {}
                        : (() => {
                            const [teamAPlayer1, teamAPlayer2] = getPreferredPlayerPairForTeam(prev.teamAId, []);
                            const [teamBPlayer1, teamBPlayer2] = getPreferredPlayerPairForTeam(prev.teamBId, [teamAPlayer1, teamAPlayer2]);
                            return { teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2 };
                          })())
                    }));
                  }}
                >
                  <option value="Doubles">Doubles</option>
                  <option value="Ladder">Ladder</option>
                </select>
              </label>
            </div>
            <label>
              Date
              <input type="date" value={matchForm.date} onChange={(e) => setMatchForm((prev) => ({ ...prev, date: e.target.value }))} required />
            </label>
            {matchForm.gameType === "Doubles" ? (
              <div className="teams-grid">
                <div className="match-team-column">
                  <label>
                    Team A
                    <select
                      value={matchForm.teamAId}
                      onChange={(e) => {
                        const nextTeamAId = e.target.value;
                        setMatchForm((prev) => {
                          const [teamAPlayer1, teamAPlayer2] = getPreferredPlayerPairForTeam(nextTeamAId, [prev.teamBPlayer1, prev.teamBPlayer2]);
                          return { ...prev, teamAId: nextTeamAId, teamAPlayer1, teamAPlayer2 };
                        });
                      }}
                      required
                    >
                      <option value="">Select a team…</option>
                      {activeTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team A - Player 1
                    <select value={matchForm.teamAPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer1: e.target.value }))}>
                      <option value="">Select a player…</option>
                      {getAvailablePlayersForSlot("teamAPlayer1").map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team A - Player 2
                    <select value={matchForm.teamAPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer2: e.target.value }))}>
                      <option value="">Select a player…</option>
                      {getAvailablePlayersForSlot("teamAPlayer2").map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="match-team-column">
                  <label>
                    Team B
                    <select
                      value={matchForm.teamBId}
                      onChange={(e) => {
                        const nextTeamBId = e.target.value;
                        setMatchForm((prev) => {
                          const [teamBPlayer1, teamBPlayer2] = getPreferredPlayerPairForTeam(nextTeamBId, [prev.teamAPlayer1, prev.teamAPlayer2]);
                          return { ...prev, teamBId: nextTeamBId, teamBPlayer1, teamBPlayer2 };
                        });
                      }}
                      required
                    >
                      <option value="">Select a team…</option>
                      {activeTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team B - Player 1
                    <select value={matchForm.teamBPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer1: e.target.value }))}>
                      <option value="">Select a player…</option>
                      {getAvailablePlayersForSlot("teamBPlayer1").map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team B - Player 2
                    <select value={matchForm.teamBPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer2: e.target.value }))}>
                      <option value="">Select a player…</option>
                      {getAvailablePlayersForSlot("teamBPlayer2").map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <p className="status-msg">Ladder matches do not use teams. Select four players and the court.</p>
                <div className="teams-grid">
                  <div className="match-team-column">
                    <label>
                      Side A - Player 1
                      <select value={matchForm.teamAPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer1: e.target.value }))}>
                        <option value="">Select a player…</option>
                        {getAvailablePlayersForSlot("teamAPlayer1").map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.firstName} {player.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Side A - Player 2
                      <select value={matchForm.teamAPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamAPlayer2: e.target.value }))}>
                        <option value="">Select a player…</option>
                        {getAvailablePlayersForSlot("teamAPlayer2").map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.firstName} {player.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="match-team-column">
                    <label>
                      Side B - Player 1
                      <select value={matchForm.teamBPlayer1} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer1: e.target.value }))}>
                        <option value="">Select a player…</option>
                        {getAvailablePlayersForSlot("teamBPlayer1").map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.firstName} {player.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Side B - Player 2
                      <select value={matchForm.teamBPlayer2} onChange={(e) => setMatchForm((prev) => ({ ...prev, teamBPlayer2: e.target.value }))}>
                        <option value="">Select a player…</option>
                        {getAvailablePlayersForSlot("teamBPlayer2").map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.firstName} {player.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </>
            )}
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
            <button type="submit">{editingMatchId ? "Update Match" : "Save Match"}</button>
            {editingMatchId ? (
              <button type="button" onClick={onCancelMatchEdit}>
                Cancel Edit
              </button>
            ) : null}
          </form>
        </article>

        <article className="panel module-export-dupr">
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

        <article className="panel module-manage-matches">
          <div className="panel-header">
            <h3>Manage Matches</h3>
            <p>Edit or delete existing matches.</p>
          </div>
          <ul className="entity-list">
            {matches.map((match) => (
              <li key={match.id}>
                <span>
                  {match.date} - {match.teamAName} ({match.scoreA}) vs {match.teamBName} ({match.scoreB}) - {match.gameType}, {match.scoringType}, {match.courtName || "No court"}
                </span>
                <div>
                  <button type="button" onClick={() => onEditMatch(match)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => onDeleteMatch(match.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel module-manage-players">
          <div className="panel-header">
            <h3>Manage Players</h3>
            <p>Add, activate/deactivate, or modify player records.</p>
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
                DUPR ID
                <input value={playerForm.duprId} onChange={(e) => setPlayerForm((prev) => ({ ...prev, duprId: e.target.value }))} required />
              </label>
              <label>
                Default Team
                <select
                  value={playerForm.defaultTeamId}
                  onChange={(e) => setPlayerForm((prev) => ({ ...prev, defaultTeamId: e.target.value }))}
                >
                  <option value="">No default team</option>
                  {activeTeams.map((team) => (
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
                        duprId: player.duprId,
                        defaultTeamId: player.defaultTeamId ?? "",
                        isActive: player.isActive
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className={player.isActive ? "danger" : ""} onClick={() => onTogglePlayerActive(player)}>
                    {player.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel module-manage-teams">
          <div className="panel-header">
            <h3>Manage Teams</h3>
            <p>Add, activate/deactivate, or modify team records.</p>
          </div>
          <form className="match-form" onSubmit={onSaveTeam}>
            <label>
              Team Name
              <input value={teamForm.name} onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <fieldset style={{ border: "1px solid #ccc", borderRadius: 4, padding: "8px 12px" }}>
              <legend>Leagues</legend>
              {leagues.map((league) => (
                <label key={league.id} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "normal", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={teamForm.leagueIds.includes(league.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTeamForm((prev) => ({ ...prev, leagueIds: [...prev.leagueIds, league.id] }));
                      } else {
                        setTeamForm((prev) => ({ ...prev, leagueIds: prev.leagueIds.filter((lid) => lid !== league.id) }));
                      }
                    }}
                  />
                  {league.name}
                </label>
              ))}
            </fieldset>
            <button type="submit">{editingTeamId ? "Update Team" : "Add Team"}</button>
          </form>
          <ul className="entity-list">
            {teams.map((team) => (
              <li key={team.id}>
                <span>
                  {team.name}
                  {team.leagueIds.length > 0 && (
                    <> - {team.leagueIds.map((lid) => leagueNameById.get(lid) ?? lid).join(", ")}</>
                  )}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTeamId(team.id);
                      setTeamForm({ name: team.name, leagueIds: team.leagueIds, isActive: team.isActive });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className={team.isActive ? "danger" : ""} onClick={() => onToggleTeamActive(team)}>
                    {team.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel module-manage-leagues">
          <div className="panel-header">
            <h3>Manage Leagues</h3>
            <p>Add, activate/deactivate, or modify leagues.</p>
          </div>
          <form className="match-form" onSubmit={onSaveLeague}>
            <label>
              League Name
              <input value={leagueForm.name} onChange={(e) => setLeagueForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <label>
              Start Date
              <input
                type="date"
                value={leagueForm.startDate}
                onChange={(e) => setLeagueForm((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </label>
            <label>
              End Date
              <input
                type="date"
                value={leagueForm.endDate}
                onChange={(e) => setLeagueForm((prev) => ({ ...prev, endDate: e.target.value }))}
                required
              />
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
                <span>{league.name} ({formatLeagueDates(league)})</span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLeagueId(league.id);
                      setLeagueForm({
                        name: league.name,
                        startDate: league.startDate,
                        endDate: league.endDate,
                        isActive: league.isActive
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className={league.isActive ? "danger" : ""} onClick={() => onToggleLeagueActive(league)}>
                    {league.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel module-manage-courts">
          <div className="panel-header">
            <h3>Manage Courts</h3>
            <p>Add, activate/deactivate, or modify courts.</p>
          </div>
          <form className="match-form" onSubmit={onSaveCourt}>
            <label>
              Court Name
              <input value={courtForm.name} onChange={(e) => setCourtForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <button type="submit">{editingCourtId ? "Update Court" : "Add Court"}</button>
          </form>
          <ul className="entity-list">
            {courts.map((court) => (
              <li key={court.id}>
                <span>{court.name}</span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourtId(court.id);
                      setCourtForm({ name: court.name, isActive: court.isActive });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className={court.isActive ? "danger" : ""} onClick={() => onToggleCourtActive(court)}>
                    {court.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

      </section>

      {adminMessage ? <p className="panel status-msg">{adminMessage}</p> : null}
    </main>
  );
}

export default AdminPage;

