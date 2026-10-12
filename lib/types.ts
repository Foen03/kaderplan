export type Status = "yes" | "no" | "maybe";
export const REASONS = ["Krank", "Verletzt", "Arbeit/Uni", "Urlaub", "Privat", "Sonstiges"] as const;
export type Reason = (typeof REASONS)[number];

export type Team = { id: string; name: string; join_code: string };
export type Member = {
  team_id: string;
  user_id: string;
  display_name: string;
  role: "coach" | "player";
  active: boolean;
  joined_on: string;
};
export type Series = {
  id: string;
  team_id: string;
  title: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  location: string | null;
  starts_on: string;
  ends_on: string | null;
};
export type Training = {
  id: string;
  team_id: string;
  series_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  title: string;
  cancelled: boolean;
  cancel_reason: string | null;
};
export type Response = {
  training_id: string;
  user_id: string;
  status: Status;
  reason: Reason | null;
  comment: string | null;
  updated_at: string;
};
