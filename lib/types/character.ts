export type CharacterVisibility = "private" | "campaign" | "public";

export interface Character {
  id: string;
  user_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
  visibility: CharacterVisibility;
  archived: boolean;
  created_at: string;
}

export type CampaignMemberRole = "dm" | "player";

export interface Campaign {
  id: string;
  system_id: string;
  owner_id: string;
  name: string;
  description: string;
  invite_code: string;
  created_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: CampaignMemberRole;
  joined_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}
