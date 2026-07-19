export type CampaignPageVisibility = "campaign" | "dm_only";

export interface CampaignActor {
  userId: string;
  campaignOwnerId: string;
  isCampaignMember: boolean;
}

export interface CampaignPageAccess extends CampaignActor {
  pageCreatorId: string | null;
  visibility: CampaignPageVisibility;
}

export function isCampaignOwner(actor: CampaignActor): boolean {
  return actor.userId === actor.campaignOwnerId;
}

export function canViewCampaignPage(access: CampaignPageAccess): boolean {
  return (
    isCampaignOwner(access) ||
    access.userId === access.pageCreatorId ||
    (access.isCampaignMember && access.visibility === "campaign")
  );
}

export function canEditCampaignPage(access: CampaignPageAccess): boolean {
  return isCampaignOwner(access) || access.userId === access.pageCreatorId;
}

export function canEditCharacterSheet(
  actorUserId: string,
  characterOwnerId: string,
): boolean {
  return actorUserId === characterOwnerId;
}

export function canAssignCharacterToCampaign(input: {
  isCampaignOwner: boolean;
  isCampaignMember: boolean;
  characterSystemId: string;
  campaignSystemId: string;
}): boolean {
  return (
    (input.isCampaignOwner || input.isCampaignMember) &&
    input.characterSystemId === input.campaignSystemId
  );
}
