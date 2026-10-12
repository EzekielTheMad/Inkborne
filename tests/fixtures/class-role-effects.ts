import { CLASS_ROLE_ABILITIES, type ClassRoleEvidence } from "@/lib/character/class-role-effects-schema";
export const roleId = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12,"0")}`;
const selected = "2026-10-12T01:00:00Z", accepted = "2026-10-12T02:00:00Z";
export function classRoleFixture(): ClassRoleEvidence {
 const character = roleId(1), system = roleId(2), confirmation = roleId(3);
 const grant = (ability: string) => ({type:"grant",stat:`saving_throw_${ability}`,value:"proficient",originalExtension:{notes:["second","first"]}});
 const classData = (ability: string) => ({ description:"Original workshop class, never seeded.",hit_die:8,spellcasting:null,
  multiclass:{prerequisites:[],proficiencies_gained:[]},saving_throws:[ability],starting_proficiencies:[],
  levels:Array.from({length:20},(_,index)=>({level:index+1,features:[],spellcasting:null})),rawExtension:{order:["last","first"]} });
 const pin = (n: number, type: string, slug: string, data: Record<string,unknown>, effects: Record<string,unknown>[]) => ({id:roleId(n),character_id:character,content_id:roleId(n+100),content_version:1,
  context:{source:type,originalOrder:[2,1]},choice_source:null,resolved:{id:roleId(n+100),system_id:system,content_type:type,slug,name:`Original ${slug}`,version:1,
  source:"homebrew" as const,scope:"personal" as const,owner_id:roleId(9),data,effects} });
 const primary = pin(10,"class","lantern-keeper",classData("strength"),[{type:"narrative",text:"Keep this original note first.",extra:[2,1]},grant("strength"),{type:"mechanical",stat:"constitution",op:"add",value:1,extra:{keep:true}}]);
 const secondary = pin(11,"class","workshop-scout",classData("dexterity"),[grant("dexterity"),grant("dexterity")]);
 const race = pin(12,"race","workshop-folk",{size:"Medium",speed:30,languages:[],unknownLore:["b","a"]},[grant("wisdom")]);
 const feature = pin(13,"feature","original-echo",{class:"lantern-keeper",level:1,description:"Original independent class feature.",feature_type:"passive"},[grant("charisma")]);
 const feat = pin(14,"feat","steady-hands",{description:"Original independent practice.",unknownOrder:[3,1]},[grant("constitution")]);
 const occurrence = (pin: typeof primary,n: number,level: number|null) => ({id:roleId(n),character_id:character,system_id:system,content_id:pin.content_id,content_version:1,class_slug:pin.resolved.slug,
  lifecycle:"accepted" as const,selected_at:selected,acquired_character_level:level,acquisition_operation_id:confirmation,accepted_at:accepted,ended_at:null});
 const a=occurrence(primary,20,1), b=occurrence(secondary,21,null);
 const manifest = (pin: typeof primary,indices: number[],kinds: Array<"starting_save"|"independent_save">) => ({schema_version:1 as const,compiler_id:"class-save-occurrences-v1" as const,
  content_id:pin.content_id,content_version:1,system_id:system,saving_throws_snapshot:pin.resolved.data.saving_throws as Array<typeof CLASS_ROLE_ABILITIES[number]>,effects_snapshot:structuredClone(pin.resolved.effects),
  occurrences:indices.map((effect_index,index)=>({effect_index,kind:kinds[index],ability:(pin.resolved.effects[effect_index].stat as string).replace("saving_throw_","") as typeof CLASS_ROLE_ABILITIES[number],
   stat_slug:pin.resolved.effects[effect_index].stat as string,effect_snapshot:structuredClone(pin.resolved.effects[effect_index])}))});
 return {contract_version:1,character:{id:character,system_id:system,classes:[{occurrence_id:a.id,slug:a.class_slug,level:1},{occurrence_id:b.id,slug:b.class_slug,level:1}]},
  system:{id:system,slug:"dnd-5e-2014",status:"published",schema_definition:{ability_scores:CLASS_ROLE_ABILITIES.map(slug=>({slug,name:slug,abbr:slug.slice(0,3)})),
   proficiency_levels:[{slug:"proficient",name:"Proficient",multiplier:1}],derived_stats:[{slug:"proficiency_bonus",name:"Proficiency bonus",formula:"floor((level - 1) / 4) + 2"}],
   skills:[],resources:[],content_types:[{slug:"class",name:"Class"}],currencies:[],creation_steps:[{step:1,type:"class",label:"Class"}],sheet_sections:[{slug:"header",label:"Header"}]}},
  current_proficiency_bonus:2,origin:{schema_version:1,character_id:character,system_id:system,command_revision:"3",origin_status:"recorded",origin_occurrence_id:a.id,
   creation_provenance:"new_character",creation_operation_id:roleId(4),source_draft_operation_id:null,
   role_proof:{kind:"confirmation",receipt:{canonical_intent:{contract_version:1,command:"confirm_origin",character_id:character,operation_id:confirmation,expected_revision:"2",selected_occurrence_id:a.id},applied_revision:"3",accepted_at:accepted}}},
  occurrences:[a,b],sources:[race,secondary,feature,primary,feat],manifests:[manifest(primary,[1],["starting_save"]),manifest(secondary,[0,1],["starting_save","independent_save"])]};
}
export function provisionalRoleFixture(): ClassRoleEvidence {
 const value=classRoleFixture();
 value.origin={...value.origin!,origin_status:"draft",origin_occurrence_id:null,role_proof:null,command_revision:"2"};
 for(const occurrence of value.occurrences){occurrence.lifecycle="provisional";occurrence.acquired_character_level=null;occurrence.acquisition_operation_id=null;occurrence.accepted_at=null;}
 return value;
}
export function copiedRoleFixture(): ClassRoleEvidence {
 const value=classRoleFixture(), sourceOccurrence=structuredClone(value.occurrences[0]);
 const direct=value.origin!.role_proof!;if(direct.kind!=="confirmation")throw Error("Fixture requires direct confirmation.");
 const source_confirmation=structuredClone(direct.receipt),target=roleId(50),copyOp=roleId(51);
 value.character.id=target;for(const row of value.occurrences){row.character_id=target;row.id=roleId(row.class_slug==="lantern-keeper"?52:53);}
 value.character.classes.forEach((choice,index)=>{choice.occurrence_id=value.occurrences[index].id;});for(const pin of value.sources)pin.character_id=target;
 value.origin={...value.origin!,character_id:target,creation_provenance:"confirmed_copy",creation_operation_id:copyOp,origin_occurrence_id:value.occurrences[0].id,command_revision:"0",
  role_proof:{kind:"copy",copy_operation_id:copyOp,source_command_revision:"3",source_occurrence:sourceOccurrence,source_confirmation}};
 return value;
}
