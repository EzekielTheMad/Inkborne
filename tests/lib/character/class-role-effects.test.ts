import { describe, expect, it } from "vitest";
import { collectClassRoleEffects, matchClassRoleConfirmationReplay } from "@/lib/character/class-role-effects";
import { boundedClassRoleJson, classRoleEvidenceSchema, classRoleRevisionSchema, type ClassRoleEvidence } from "@/lib/character/class-role-effects-schema";
import { classRoleFixture, copiedRoleFixture, provisionalRoleFixture, roleId } from "@/tests/fixtures/class-role-effects";
import { collectEffects } from "@/lib/engine/effects";
import { evaluate } from "@/lib/engine/evaluator";
import { getSaveModifier } from "@/lib/sheet/helpers";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import type { Effect } from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";
function result(value: ClassRoleEvidence) {const model=collectClassRoleEffects(value);if(model.status==="invalid_evidence")throw Error(model.messages.join("; "));return model;}
function save(value:ClassRoleEvidence,effects:Record<string,unknown>[],ability="dexterity") {
 const evaluation=evaluate({strength:10,dexterity:10,constitution:10,intelligence:10,wisdom:10,charisma:10,level:2},effects as unknown as Effect[],systemSchemaDefinitionSchema.parse(value.system.schema_definition) as SystemSchemaDefinition);
 return getSaveModifier(0,evaluation.computed.proficiency_bonus,evaluation.grants,`saving_throw_${ability}`);
}
function secondary(value:ClassRoleEvidence){return value.sources.find(pin=>pin.resolved.slug==="workshop-scout")!;}
function leakOnly(value:ClassRoleEvidence){const pin=secondary(value),manifest=value.manifests.find(row=>row.content_id===pin.content_id)!;pin.resolved.effects.pop();manifest.effects_snapshot.pop();manifest.occurrences.pop();}
function directReceipt(value:ClassRoleEvidence){const proof=value.origin!.role_proof!;if(proof.kind!=="confirmation")throw Error("Fixture requires confirmation");return proof.receipt;}
describe("C1 advisory class role classifier — no live producer, authorization or app integration",()=>{
 it("admits original canonical fixtures without adding stored parser defaults or six derived saves",()=>{
  const value=classRoleFixture(), before=structuredClone(value);expect(classRoleEvidenceSchema.safeParse(value).success).toBe(true);
  for(const pin of value.sources)expect(parseContentDefinition({...pin.resolved})).not.toBeNull();
  const model=result(value);expect(model.status).toBe("available");expect(value).toEqual(before);
  expect(model.originalSources).toEqual(before.sources);expect(model.originalSources.find(pin=>pin.resolved.content_type==="class")!.resolved.data).not.toHaveProperty("source_refs");
  expect((value.system.schema_definition.derived_stats as unknown[])).toHaveLength(1);
 });
 it("current unchanged flat collector leaks secondary saves; C1 projection removes only its proven starting occurrence",()=>{
  const value=classRoleFixture();leakOnly(value);
  const flat=collectEffects(value.sources.map(pin=>pin.resolved.effects as unknown as Effect[]));
  expect(save(value,flat as unknown as Record<string,unknown>[])).toBe(2); // Current source failing-before oracle, not a claimed live repair.
  const model=result(value);expect(model.status).toBe("available");expect(model.role_state).toBe("confirmed");
  expect(save(value,model.evaluationEffects)).toBe(0);expect(save(value,model.evaluationEffects,"strength")).toBe(2);
 });
 it("two identical grants at separate indices preserve independently labelled class-level occurrence",()=>{
  const value=classRoleFixture(), pin=secondary(value);expect(pin.resolved.effects[0]).toEqual(pin.resolved.effects[1]);
  const model=result(value);expect(model.excluded).toEqual([{source_id:pin.id,effect_index:0,occurrence_id:value.occurrences[1].id}]);
  expect(model.evaluationEffects.filter(effect=>effect.stat==="saving_throw_dexterity")).toHaveLength(1);expect(save(value,model.evaluationEffects)).toBe(2);
  for(const ability of ["wisdom","constitution","charisma"])expect(save(value,model.evaluationEffects,ability)).toBe(2);
  expect(model.originalEffects).toEqual(value.sources.flatMap(pin=>pin.resolved.effects));
  expect(model.evaluationEffects).toEqual(value.sources.flatMap(pin=>pin.resolved.effects.filter((_effect,index)=>pin.id!==secondary(value).id||index!==0)));
 });
 it("basic-class compiler uses exactly the selected starting grant occurrences, never incidental effects",()=>{
  const value=classRoleFixture(), pin=value.sources.find(pin=>pin.resolved.slug==="lantern-keeper")!, manifest=value.manifests.find(row=>row.content_id===pin.content_id)!;
  pin.resolved.effects=[pin.resolved.effects[1]];manifest.effects_snapshot=structuredClone(pin.resolved.effects);manifest.occurrences[0].effect_index=0;manifest.compiler_id="private-basic-class-v1";
  expect(result(value).status).toBe("available");pin.resolved.effects.push({type:"narrative",text:"Unexpected basic compiler effect"});manifest.effects_snapshot=structuredClone(pin.resolved.effects);
  expect(result(value).status).toBe("unavailable");
 });
 it("class and source fetch order are not origin proof; original arrays stay ordered",()=>{
  const value=classRoleFixture();leakOnly(value);value.character.classes.reverse();value.sources.reverse();value.occurrences.reverse();value.manifests.reverse();
  const model=result(value);expect(model.status).toBe("available");expect(save(value,model.evaluationEffects)).toBe(0);expect(save(value,model.evaluationEffects,"strength")).toBe(2);
  expect(model.originalEffects).toEqual(value.sources.flatMap(pin=>pin.resolved.effects));
 });
 it("manifest object key order is immaterial but significant array order tampering is unavailable",()=>{
  const value=classRoleFixture();value.manifests[0].effects_snapshot=value.manifests[0].effects_snapshot.map(effect=>Object.fromEntries(Object.entries(effect).reverse()));
  expect(result(value).status).toBe("available");value.manifests[0].effects_snapshot.reverse();expect(result(value).status).toBe("unavailable");
 });
 it.each([
  {name:"missing manifest",affected:["strength","dexterity"] as const,change:(v:ClassRoleEvidence)=>{v.manifests=[];}},
  {name:"duplicate manifest",affected:["strength"] as const,change:(v:ClassRoleEvidence)=>{v.manifests.push(structuredClone(v.manifests[0]));}},
  {name:"duplicate index",affected:["dexterity"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[1].occurrences[1].effect_index=0;}},
  {name:"unclassified identical grant",affected:["dexterity"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[1].occurrences.pop();}},
  {name:"wrong kind/declaration",affected:["dexterity"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[1].occurrences[0].kind="independent_save";}},
  {name:"wrong version",affected:["strength"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[0].content_version=2;}},
  {name:"wrong system",affected:["strength"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[0].system_id=roleId(99);}},
  {name:"raw extension changed",affected:["strength"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[0].effects_snapshot[0].extra=[1,2];}},
  {name:"wrong raw paired value",affected:["strength"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[0].occurrences[0].effect_snapshot.value="expertise";}},
  {name:"basic compiler cannot claim independent grant",affected:["dexterity"] as const,change:(v:ClassRoleEvidence)=>{v.manifests[1].compiler_id="private-basic-class-v1";}},
 ])("refuses $name without tuple-based guessing or raw rewrites",({change,affected})=>{
  const value=classRoleFixture();change(value);const before=structuredClone(value),model=result(value);expect(model.status).toBe("unavailable");
  for(const ability of affected)expect(model.saveAvailability[ability].status).toBe("unavailable");
  expect(model.saveAvailability.wisdom.status).toBe("available");expect(save(value,model.evaluationEffects,"wisdom")).toBe(2);
  expect(model.originalSources).toEqual(before.sources);expect(model.originalEffects).toEqual(before.sources.flatMap(pin=>pin.resolved.effects));expect(value).toEqual(before);
 });
 it.each(["draft","legacy","invalid-primary-manifest"] as const)("%s only blocks affected class saves, leaving independent unrelated saves usable",mode=>{
  const value=mode==="draft"?provisionalRoleFixture():classRoleFixture();
  if(mode==="legacy")value.origin=null;
  if(mode==="invalid-primary-manifest")value.manifests=value.manifests.filter(row=>row.content_id!==value.occurrences[0].content_id);
  const before=structuredClone(value),model=result(value);
  expect(model.saveAvailability.strength.status).toBe("unavailable");
  for(const ability of ["wisdom","constitution","charisma"] as const){expect(model.saveAvailability[ability]).toEqual({status:"available",issues:[]});expect(save(value,model.evaluationEffects,ability)).toBe(2);}
  expect(model.originalSources).toEqual(before.sources);expect(model.originalEffects).toEqual(before.sources.flatMap(pin=>pin.resolved.effects));expect(value).toEqual(before);
  const independent=before.sources.filter(pin=>pin.resolved.content_type!=="class").flatMap(pin=>pin.resolved.effects);
  expect(model.evaluationEffects.filter(effect=>["saving_throw_wisdom","saving_throw_constitution","saving_throw_charisma"].includes(String(effect.stat)))).toEqual(independent);
  if(mode!=="invalid-primary-manifest"){expect(model.excluded).toEqual([]);expect(model.evaluationEffects).toEqual(model.originalEffects);}
 });
 it("an unclassified STR candidate does not overblock known WIS race or valid DEX secondary classification",()=>{
  const value=classRoleFixture();leakOnly(value);value.manifests=value.manifests.filter(row=>row.content_id!==value.occurrences[0].content_id);
  const before=structuredClone(value),model=result(value);
  expect(model.saveAvailability.strength.status).toBe("unavailable");expect(model.saveAvailability.dexterity).toEqual({status:"available",issues:[]});
  expect(model.saveAvailability.wisdom).toEqual({status:"available",issues:[]});expect(save(value,model.evaluationEffects)).toBe(0);expect(save(value,model.evaluationEffects,"wisdom")).toBe(2);
  expect(model.excluded).toEqual([{source_id:secondary(value).id,effect_index:0,occurrence_id:value.occurrences[1].id}]);
  expect(model.evaluationEffects).toEqual(before.sources.flatMap(pin=>pin.resolved.effects.filter((_effect,index)=>pin.id!==secondary(value).id||index!==0)));
  expect(model.originalEffects).toEqual(before.sources.flatMap(pin=>pin.resolved.effects));expect(value).toEqual(before);
 });
 it.each(["draft","legacy"] as const)("%s preserves a proven unrelated independent class-level save",mode=>{
  const value=mode==="draft"?provisionalRoleFixture():classRoleFixture();if(mode==="legacy")value.origin=null;
  const pin=secondary(value), manifest=value.manifests.find(row=>row.content_id===pin.content_id)!;
  const effect={type:"grant",stat:"saving_throw_intelligence",value:"proficient",originalOrder:[2,1]};pin.resolved.effects.push(effect);
  manifest.effects_snapshot=structuredClone(pin.resolved.effects);manifest.occurrences.push({effect_index:2,kind:"independent_save",ability:"intelligence",stat_slug:effect.stat,effect_snapshot:structuredClone(effect)});
  const before=structuredClone(value),model=result(value);expect(model.saveAvailability.intelligence).toEqual({status:"available",issues:[]});
  expect(save(value,model.evaluationEffects,"intelligence")).toBe(2);expect(model.evaluationEffects).toEqual(model.originalEffects);
  expect(model.originalSources).toEqual(before.sources);expect(value).toEqual(before);
 });
 it("same-ability ambiguity can deny STR even while the independent STR grant remains raw and ordered",()=>{
  const value=classRoleFixture(),feat=value.sources.find(pin=>pin.resolved.content_type==="feat")!;
  feat.resolved.effects.push({type:"grant",stat:"saving_throw_strength",value:"proficient",extra:{retain:true}});value.manifests=value.manifests.filter(row=>row.content_id!==value.occurrences[0].content_id);
  const before=structuredClone(value),model=result(value);expect(model.saveAvailability.strength.status).toBe("unavailable");
  expect(model.evaluationEffects.filter(effect=>effect.stat==="saving_throw_strength")).toEqual(before.sources.flatMap(pin=>pin.resolved.effects.filter(effect=>effect.stat==="saving_throw_strength")));
  expect(model.saveAvailability.wisdom.status).toBe("available");expect(model.originalEffects).toEqual(before.sources.flatMap(pin=>pin.resolved.effects));
 });
 it("a genuinely missing exact class graph reports explicit broader unknown scope, without guessing harmless declarations",()=>{
  const value=classRoleFixture();value.sources=value.sources.filter(pin=>pin.content_id!==value.occurrences[0].content_id);
  const before=structuredClone(value),model=result(value);expect(model.excluded).toEqual([]);
  for(const state of Object.values(model.saveAvailability)){expect(state.status).toBe("unavailable");expect(state.issues.some(issue=>issue.reason==="UNKNOWN_ROLE_GRAPH")).toBe(true);}
  expect(model.evaluationEffects).toEqual(model.originalEffects);expect(model.originalSources).toEqual(before.sources);expect(value).toEqual(before);
 });
 it("unmappable role-sensitive raw ability evidence is broader unknown, not falsely admitted as unrelated",()=>{
  const value=classRoleFixture(),pin=secondary(value);pin.resolved.effects.push({type:"grant",stat:"saving_throw_unknown-ability",value:"proficient"});
  const model=result(value);expect(model.saveAvailability.wisdom.status).toBe("unavailable");expect(model.saveAvailability.wisdom.issues.some(issue=>issue.reason==="UNKNOWN_ROLE_GRAPH")).toBe(true);
 });
 it("strict occurrence manifest admission rejects an unknown snapshot ability without changing the raw class declaration",()=>{
  const value=classRoleFixture(),pin=secondary(value);
  const invalid={...value,manifests:value.manifests.map(manifest=>manifest.content_id===pin.content_id?
   {...manifest,saving_throws_snapshot:[...manifest.saving_throws_snapshot,"unknown-ability"]}:manifest)};
  const before=structuredClone(invalid);expect(pin.resolved.data.saving_throws).toEqual(["dexterity"]);
  expect(parseContentDefinition({...pin.resolved})).not.toBeNull();
  expect(collectClassRoleEffects(invalid).status).toBe("invalid_evidence");expect(invalid).toEqual(before);
 });
 it("an unknown raw class saving throw with a known manifest remains canonically admitted but broader role-unavailable",()=>{
  const value=classRoleFixture(),pin=secondary(value),manifest=value.manifests.find(row=>row.content_id===pin.content_id)!;
  pin.resolved.data.saving_throws=[...pin.resolved.data.saving_throws as string[],"unknown-ability"];
  expect(manifest.saving_throws_snapshot).toEqual(["dexterity"]);expect(parseContentDefinition({...pin.resolved})).not.toBeNull();
  const before=structuredClone(value),model=result(value);expect(model.status).toBe("unavailable");
  for(const state of Object.values(model.saveAvailability)){expect(state.status).toBe("unavailable");expect(state.issues.some(issue=>issue.reason==="UNKNOWN_ROLE_GRAPH")).toBe(true);}
  expect(model.excluded).toEqual([]);expect(model.originalSources).toEqual(before.sources);
  expect(model.originalEffects).toEqual(before.sources.flatMap(source=>source.resolved.effects));
  expect(model.evaluationEffects).toEqual(model.originalEffects);expect(value).toEqual(before);
 });
 it("active origin occurrences without their selected raw class graph remain explicitly broader unknown",()=>{
  const value=classRoleFixture();value.character.classes=[];value.sources=value.sources.filter(pin=>pin.resolved.content_type!=="class");
  const model=result(value);expect(model.status).toBe("unavailable");expect(model.saveAvailability.wisdom.issues.some(issue=>issue.reason==="UNKNOWN_ROLE_GRAPH")).toBe(true);
  expect(model.excluded).toEqual([]);expect(model.evaluationEffects).toEqual(model.originalEffects);
 });
 it.each(["independent-only","no-saves"] as const)("unselected extra class source with %s manifest cannot bypass graph denial",mode=>{
  const value=classRoleFixture(), pin=structuredClone(secondary(value));pin.id=roleId(901);pin.content_id=roleId(902);pin.resolved.id=pin.content_id;
  pin.resolved.slug="unselected-workshop-class";pin.resolved.name="Original unselected class";pin.resolved.data.saving_throws=[];
  pin.resolved.effects=mode==="independent-only"?[{type:"grant",stat:"saving_throw_wisdom",value:"proficient",originalNotes:[2,1]}]:[];
  value.sources.push(pin);value.manifests.push({schema_version:1,compiler_id:"class-save-occurrences-v1",content_id:pin.content_id,content_version:pin.content_version,
   system_id:value.character.system_id,saving_throws_snapshot:[],effects_snapshot:structuredClone(pin.resolved.effects),occurrences:mode==="independent-only"?
    [{effect_index:0,kind:"independent_save",ability:"wisdom",stat_slug:"saving_throw_wisdom",effect_snapshot:structuredClone(pin.resolved.effects[0])}]:[]});
  const before=structuredClone(value),model=result(value);expect(model.status).toBe("unavailable");expect(model.role_state).toBe("unavailable");expect(model.excluded).toEqual([]);
  for(const state of Object.values(model.saveAvailability)){expect(state.status).toBe("unavailable");expect(state.issues.some(issue=>issue.reason==="UNKNOWN_ROLE_GRAPH")).toBe(true);}
  expect(model.originalSources).toEqual(before.sources);expect(model.originalEffects).toEqual(before.sources.flatMap(source=>source.resolved.effects));
  expect(model.evaluationEffects).toEqual(model.originalEffects);expect(value).toEqual(before);
 });
 it("additional canonical nonclass independent source remains usable and ordered",()=>{
  const value=classRoleFixture(), pin=structuredClone(value.sources.find(source=>source.resolved.content_type==="feat")!);
  pin.id=roleId(903);pin.content_id=roleId(904);pin.resolved.id=pin.content_id;pin.resolved.slug="original-extra-practice";
  pin.resolved.effects=[{type:"grant",stat:"saving_throw_intelligence",value:"proficient",orderedNotes:[2,1]}];value.sources.push(pin);
  const before=structuredClone(value),model=result(value);expect(model.status).toBe("available");expect(model.saveAvailability.intelligence).toEqual({status:"available",issues:[]});
  expect(save(value,model.evaluationEffects,"intelligence")).toBe(2);expect(model.evaluationEffects.at(-1)).toEqual(pin.resolved.effects[0]);
  expect(model.originalSources).toEqual(before.sources);expect(model.originalEffects).toEqual(before.sources.flatMap(source=>source.resolved.effects));expect(value).toEqual(before);
 });
 it("provisional A->remove->B/reorder/readback never seals an origin",()=>{
  const value=provisionalRoleFixture();expect(result(value).role_state).toBe("provisional");
  const removed=value.occurrences[0];removed.lifecycle="ended";removed.ended_at="2026-10-12T03:00:00Z";
  value.character.classes.shift();value.sources=value.sources.filter(pin=>pin.content_id!==removed.content_id);value.character.classes.reverse();
  const model=result(value);expect(model.role_state).toBe("provisional");expect(model.status).toBe("unavailable");expect(model.excluded).toEqual([]);
  expect(model.evaluationEffects).toEqual(model.originalEffects);expect(value.origin!.origin_occurrence_id).toBeNull();expect(value.origin!.role_proof).toBeNull();
  expect(result(structuredClone(value)).role_state).toBe("provisional");
 });
 it("legacy empty or single-class data never mints fresh draft proof",()=>{
  for(const classes of [[],classRoleFixture().character.classes.slice(0,1)]){const value=classRoleFixture();value.origin=null;value.character.classes=classes;
   const model=result(value);expect(model.role_state).toBe("unavailable");expect(model.saveAvailability.strength.issues[0].reason).toBe("LEGACY_UNAVAILABLE");expect(model.excluded).toEqual([]);}
 });
 it("removed original role cannot transfer to a retained or reinserted class",()=>{
  const value=classRoleFixture(), original=value.occurrences[0];original.lifecycle="ended";original.ended_at="2026-10-12T03:00:00Z";
  value.character.classes.shift();value.sources=value.sources.filter(pin=>pin.content_id!==original.content_id);
  expect(result(value).saveAvailability.dexterity.issues[0].reason).toBe("ORIGIN_REMOVED_UNAVAILABLE");
  const reinsert={...original,id:roleId(80),lifecycle:"accepted" as const,ended_at:null,acquisition_operation_id:roleId(81)};
  value.occurrences.push(reinsert);value.character.classes.push({occurrence_id:reinsert.id,slug:reinsert.class_slug,level:1});
  const pin=classRoleFixture().sources.find(pin=>pin.content_id===original.content_id)!;value.sources.push(pin);
  expect(result(value).role_state).toBe("unavailable");expect(result(value).excluded).toEqual([]);
 });
 it("confirmed copies preserve source role at exact pin and remapped occurrence",()=>{
  const value=copiedRoleFixture();leakOnly(value);expect(result(value).status).toBe("available");expect(save(value,result(value).evaluationEffects)).toBe(0);
  const proof=value.origin!.role_proof!;if(proof.kind!=="copy")throw Error("Expected copy fixture");proof.source_occurrence.content_version=2;
  expect(result(value).saveAvailability.strength.issues[0].reason).toBe("ORIGIN_PROOF_UNAVAILABLE");
 });
 it("copied ended origin is unavailable, never reactivated by target current ordering",()=>{
  const value=copiedRoleFixture(), proof=value.origin!.role_proof!;if(proof.kind!=="copy")throw Error("Expected copy");
  const ended="2026-10-12T03:00:00Z";proof.source_occurrence.lifecycle="ended";proof.source_occurrence.ended_at=ended;
  value.occurrences[0].lifecycle="ended";value.occurrences[0].ended_at=ended;value.character.classes.shift();
  value.sources=value.sources.filter(pin=>pin.content_id!==value.occurrences[0].content_id);
  const model=result(value);expect(model.role_state).toBe("unavailable");expect(model.excluded).toEqual([]);
  expect(model.saveAvailability.dexterity.issues[0].reason).toBe("ORIGIN_REMOVED_UNAVAILABLE");
 });
 it("draft copy lineage stays provisional; partial restore cannot turn legacy into a draft",()=>{
  const value=provisionalRoleFixture();value.origin!.creation_provenance="fresh_draft_copy";value.origin!.source_draft_operation_id=roleId(88);
  expect(result(value).role_state).toBe("provisional");value.origin!.creation_operation_id=null;
  expect(result(value).role_state).toBe("unavailable");
 });
 it.each([
  {name:"missing operation proof",change:(v:ClassRoleEvidence)=>{v.origin!.role_proof=null;}},
  {name:"wrong selected occurrence",change:(v:ClassRoleEvidence)=>{directReceipt(v).canonical_intent.selected_occurrence_id=v.occurrences[1].id;}},
  {name:"wrong character proof",change:(v:ClassRoleEvidence)=>{directReceipt(v).canonical_intent.character_id=roleId(89);}},
  {name:"old receipt revision",change:(v:ClassRoleEvidence)=>{directReceipt(v).applied_revision="2";}},
  {name:"origin header behind accepted revision",change:(v:ClassRoleEvidence)=>{v.origin!.command_revision="2";}},
  {name:"origin pin absent",change:(v:ClassRoleEvidence)=>{v.sources=v.sources.filter(pin=>pin.content_id!==v.occurrences[0].content_id);}},
  {name:"same slug wrong pin",change:(v:ClassRoleEvidence)=>{v.sources.find(pin=>pin.resolved.slug===v.occurrences[0].class_slug)!.content_version=2;v.sources.find(pin=>pin.resolved.slug===v.occurrences[0].class_slug)!.resolved.version=2;}},
 ])("incomplete or mismatched $name never permits secondary exclusion",({change})=>{const value=classRoleFixture();change(value);const model=result(value);expect(model.status).toBe("unavailable");expect(model.excluded).toEqual([]);});
 it("legacy save_ namespace remains raw and separately unavailable, without silent rewrite",()=>{
  const value=classRoleFixture();secondary(value).resolved.effects[0].stat="save_dexterity";
  const model=result(value);expect(model.status).toBe("unavailable");expect(model.originalEffects.some(effect=>effect.stat==="save_dexterity")).toBe(true);
  expect(model.saveAvailability.dexterity.issues.some(issue=>issue.reason==="LEGACY_SAVE_NAMESPACE")).toBe(true);
  expect(getSaveModifier(0,2,[{type:"grant",stat:"save_dexterity",value:"proficient"}],"saving_throw_dexterity")).toBe(0);
 });
 it.each(["-1","01","1e2","9223372036854775808", "999999999999999999999"])("rejects revision %s without unsafe conversion",revision=>{expect(()=>classRoleRevisionSchema.safeParse(revision)).not.toThrow();expect(classRoleRevisionSchema.safeParse(revision).success).toBe(false);});
 it("accepts bigint boundary as decimal string and rejects invalid system/proficiency/PB",()=>{
  const value=classRoleFixture();value.origin!.command_revision="9223372036854775807";expect(result(value).status).toBe("available");
  value.current_proficiency_bonus=Infinity;expect(collectClassRoleEffects(value).status).toBe("invalid_evidence");
 });
 it.each([
  {name:"duplicate ability",change:(v:ClassRoleEvidence)=>{const list=v.system.schema_definition.ability_scores as Array<{slug:string}>;list[5].slug=list[0].slug;}},
  {name:"missing ability",change:(v:ClassRoleEvidence)=>{(v.system.schema_definition.ability_scores as unknown[]).pop();}},
  {name:"wrong proficient multiplier",change:(v:ClassRoleEvidence)=>{(v.system.schema_definition.proficiency_levels as Array<{multiplier:number}>)[0].multiplier=2;}},
  {name:"duplicate source ID",change:(v:ClassRoleEvidence)=>{v.sources[1].id=v.sources[0].id;}},
  {name:"foreign character pin",change:(v:ClassRoleEvidence)=>{v.sources[0].character_id=roleId(99);}},
  {name:"duplicate class occurrence",change:(v:ClassRoleEvidence)=>{v.occurrences.push(structuredClone(v.occurrences[0]));}},
  {name:"ended before selected",change:(v:ClassRoleEvidence)=>{v.occurrences[0].lifecycle="ended";v.occurrences[0].ended_at="2026-10-11T23:00:00Z";}},
 ])("rejects $name structure without claiming read authority",({change})=>{const value=classRoleFixture();change(value);expect(collectClassRoleEffects(value).status).toBe("invalid_evidence");});
 it("rejects invented authority boolean, cyclic/nonJSON or oversized evidence",()=>{
  expect(collectClassRoleEffects({...classRoleFixture(),read_authorized:true}).status).toBe("invalid_evidence");
  const cycle:Record<string,unknown>={};cycle.self=cycle;expect(boundedClassRoleJson(cycle)).toBe(false);expect(collectClassRoleEffects(cycle).status).toBe("invalid_evidence");
  expect(boundedClassRoleJson({value:undefined})).toBe(false);expect(boundedClassRoleJson({value:"x".repeat(4194305)})).toBe(false);
  const value=classRoleFixture();value.manifests[0].effects_snapshot[0].tooLarge="x".repeat(131073);expect(collectClassRoleEffects(value).status).toBe("invalid_evidence");
 });
 it("receipt replay matches unchanged intent, not altered identity/revision; authenticity remains P1",()=>{
  const receipt=directReceipt(classRoleFixture()), request=structuredClone(receipt.canonical_intent);
  expect(matchClassRoleConfirmationReplay(receipt,Object.fromEntries(Object.entries(request).reverse()))).toBe("same_intent");
  expect(matchClassRoleConfirmationReplay(receipt,{...request,selected_occurrence_id:roleId(77)})).toBe("changed_intent");
  expect(matchClassRoleConfirmationReplay(receipt,{...request,expected_revision:"3"})).toBe("changed_intent");
  expect(matchClassRoleConfirmationReplay(receipt,{...request,character_id:roleId(78)})).toBe("different_operation");
  expect(matchClassRoleConfirmationReplay({...receipt,applied_revision:"2"},request)).toBe("invalid_evidence");
  expect(result(classRoleFixture())).not.toHaveProperty("authorized"); // Self-consistent DTOs are not proof of a real producer/read.
 });
});
