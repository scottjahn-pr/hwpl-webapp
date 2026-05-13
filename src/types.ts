export type TeamSide = "A" | "B";
export type Persona = "user" | "admin";

export interface League {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Court {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  leagueIds: string[];
  isActive: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  duprId: string;
  defaultTeamId: string | null;
  isActive: boolean;
}

export interface Match {
  id: string;
  leagueId: string;
  courtId: string;
  scoringType: "Standard" | "Rally";
  gameType: "Doubles" | "Ladder";
  date: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
  scoreA: number;
  scoreB: number;
}

export interface StatsRow {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  winRate: number;
}

export interface LeagueStatRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  matches: number;
  avgPointsPerMatch: number;
}

export interface RecentMatch {
  id: string;
  date: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
}

export interface SessionTeamStat {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  winRate: number;
}

export interface SessionPlayerStat {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  winRate: number;
}

export interface SessionCourtEntry {
  courtId: string;
  courtName: string;
  doubles: SessionTeamStat[];
  ladder: SessionPlayerStat[];
}
