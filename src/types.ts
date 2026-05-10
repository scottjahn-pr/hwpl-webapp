export type TeamSide = "A" | "B";
export type Persona = "user" | "admin";

export interface League {
  id: string;
  name: string;
  season: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  leagueId: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  duprId: string;
  defaultTeamId: string;
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
