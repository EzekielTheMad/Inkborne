export interface AbilityScoreDefinition {
  slug: string;
  name: string;
  abbr: string;
}

export interface ProficiencyLevel {
  slug: string;
  name: string;
  multiplier: number;
}

export interface DerivedStatDefinition {
  slug: string;
  name: string;
  formula?: string;
  base?: number;
  note?: string;
}

export interface SkillDefinition {
  slug: string;
  name: string;
  ability: string;
}

export interface ResourceDefinition {
  slug: string;
  name: string;
  type: "current_max_temp" | "pool" | "slots_by_level" | "success_fail";
  per?: string;
  levels?: number[];
  max_each?: number;
}

export interface ContentTypeDefinition {
  slug: string;
  name: string;
  plural?: string;
  required?: boolean;
  max?: number | null;
  parent?: string;
}

export interface CurrencyDefinition {
  slug: string;
  name: string;
  rate: number;
}

export interface CreationStep {
  step: number;
  type: string;
  label: string;
  methods?: string[];
  fields?: string[];
}

export interface SheetSection {
  slug: string;
  label: string;
  contains?: string[];
  tab?: boolean;
  extension_zone?: boolean;
}

export interface SystemSchemaDefinition {
  ability_scores: AbilityScoreDefinition[];
  proficiency_levels: ProficiencyLevel[];
  derived_stats: DerivedStatDefinition[];
  skills: SkillDefinition[];
  resources: ResourceDefinition[];
  content_types: ContentTypeDefinition[];
  currencies: CurrencyDefinition[];
  creation_steps: CreationStep[];
  sheet_sections: SheetSection[];
}

export interface GameSystem {
  id: string;
  slug: string;
  name: string;
  version_label: string;
  schema_definition: SystemSchemaDefinition;
  expression_context: Record<string, unknown>;
  status: "draft" | "published";
  created_at: string;
}
