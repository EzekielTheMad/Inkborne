// Staged-only interfaces. Not generated hosted schema evidence.
import type { InstanceDetail, InstanceSummary, InstanceRequest, SourcePreview, InstanceReceipt } from "@/lib/campaigns/monster-instance-schema";
export interface CampaignMonsterStage {
  // Raw table bigint JSON may already be rounded; never consume it as a revision.
  campaign_monster_instances: Omit<InstanceDetail, "revision"> & { revision: unknown; created_by: string; created_at: string };
  read_campaign_monster_source_v1: { Args: { target_campaign_id: string; target_content_id: string; target_version: number }; Returns: SourcePreview };
  commit_campaign_monster_instance_v1: { Args: { target_campaign_id: string; request: InstanceRequest }; Returns: InstanceReceipt };
  resolve_campaign_monster_command_v1: { Args: { target_campaign_id: string; target_operation_id: string }; Returns: { status: "absent" } | { status: "saved"; receipt: InstanceReceipt } };
  list_campaign_monster_instances_v1: { Args: { target_campaign_id: string; show_archived: boolean; name_search: string; page_number: number }; Returns: InstanceSummary[] };
  get_campaign_monster_instance_v1: { Args: { target_campaign_id: string; target_instance_id: string }; Returns: InstanceDetail | null };
}
