export type TeamSide = "A" | "B";
export type Persona = "user" | "admin";

export interface League {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  leagueId: string;
  isActive: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  duprId: string;
  defaultTeamId: string;
  isActive: boolean;
}

export interface Match {
  id: string;
  leagueId: string;
  date: string;
  teamAId: string;
  teamBId: string;
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
