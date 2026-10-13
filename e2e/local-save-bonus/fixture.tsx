import {useEffect,useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CharacterProvider,useCharacter,useCharacterState,useRolls,useConcentration} from '@/lib/character/character-context';
import {SheetPanel} from '@/components/character/sheet-panel';
import {ConcentrationPrompt} from '@/components/sheet/concentration-prompt';
import {buildCustomActiveEffect,collectActiveEffects,collectRollModifiers} from '@/lib/active-effects/helpers';
import {buildConcentrationSaveRequest} from '@/lib/active-effects/concentration';
import {buildD20RollRequest} from '@/lib/rolls/requests';
import {parseContentDefinition,parseContentVersionSnapshot} from '@/lib/supabase/content-definitions-parser';
import {systemSchemaDefinitionSchema} from '@/lib/schemas/system';
import {buildCharacterStructuredSources} from '@/lib/character/structured-sources';
import {evaluate} from '@/lib/engine/evaluator';
import {resolveSavingThrowModifier} from '@/lib/sheet/helpers';
import {getConfirmedAbilityModifier} from '@/lib/character/ability-mechanics';
import type {CharacterWithSystem,CharacterState} from '@/lib/types/character';
import type {ContentRefWithContent} from '@/lib/supabase/content-refs';
import type {Effect} from '@/lib/types/effects';
import type {ClassContentData} from '@/lib/character/character-context';
import type {SystemSchemaDefinition} from '@/lib/types/system';

export const scenarioNames=['neutral','plus-one','negative','independent-adds','condition-false','condition-true','riders','unsupported-string','tagged-formula','fractional','unsafe-final','manual-recovery','retained-save','open-con','retained-print'] as const;
type Scenario=typeof scenarioNames[number];
type Journal={rng:unknown[];results:Array<{request:{kind:string;expression:string};total:number}>;logs:unknown[];writes:unknown[];prints:unknown[];navigation:unknown[];unexpected:unknown[];probes:unknown[]};
type Harness={scenario:Scenario;journal:Journal;snapshot?:Record<string,unknown>;rawPins:unknown;rawState:CharacterState;mutate?:(kind:string)=>void;probe?:(kind:string)=>void;capture?:()=>void;retainedReady?:boolean;captureAdmission?:{actualGuardPassed:boolean;pendingCheck:unknown}};
declare global{interface Window{saveBonus:Harness;saveBonusSeed:SystemSchemaDefinition}}
const requested=new URLSearchParams(location.search).get('case');
if(!scenarioNames.includes(requested as Scenario))throw Error('Unknown finite save-bonus fixture');
const scenario=requested as Scenario;
const variant=new URLSearchParams(location.search).get('variant');
if(variant!==null&&(scenario!=='tagged-formula'||variant!=='untagged'))throw Error('Unknown finite fixture variant');
window.saveBonus={scenario,journal:{rng:[],results:[],logs:[],writes:[],prints:[],navigation:[],unexpected:[],probes:[]},rawPins:[],rawState:{}};
// Only the invocation boundary is modeled. Actual captured print guard runs first;
// separate page.pdf exports produce real browser PDF bytes.
window.print=()=>{window.saveBonus.journal.prints.push({simulatedNativeDialog:true})};
const ids={character:'a6111111-1111-4111-8111-111111111111',system:'a6222222-2222-4222-8222-222222222222',owner:'a6333333-3333-4333-8333-333333333333',feat:'a6444444-4444-4444-8444-444444444444',featRef:'a6555555-5555-4555-8555-555555555555',class:'a6888888-8888-4888-8888-888888888888',classRef:'a6999999-9999-4999-8999-999999999999'};
const instant='2026-10-13T15:00:00.000Z';
function pin(type:string,id:string,slug:string,version:number,data:Record<string,unknown>,effects:Effect[]){
 const raw={id,system_id:ids.system,version,content_type:type,slug,name:type==='class'?'Synthetic Lantern Steward':'Synthetic Lantern Poise',source:'homebrew',scope:'personal',owner_id:ids.owner,data,effects};
 const current=parseContentDefinition(raw),snapshot={content_id:id,version,system_id_snapshot:ids.system,content_type_snapshot:type,slug_snapshot:slug,name_snapshot:raw.name,source_snapshot:raw.source,scope_snapshot:raw.scope,owner_id_snapshot:ids.owner,data_snapshot:data,effects_snapshot:effects};
 const parsed=parseContentVersionSnapshot(snapshot);if(!current||!parsed)throw Error('Original current/immutable fixture must parse');
 const ref:ContentRefWithContent={id:type==='class'?ids.classRef:ids.featRef,character_id:ids.character,content_id:id,content_version:version,feature_grant_id:null,context:{source:type,dm_secret:'FORBIDDEN_CONTEXT'},choice_source:null,created_at:instant,content_definitions:parsed};
 return{raw,snapshot,current,ref};
}
function original(){
 const schema=systemSchemaDefinitionSchema.parse(window.saveBonusSeed),bonus:Effect[]=[];
 if(scenario==='independent-adds')bonus.push({type:'mechanical',stat:'saving_throw_bonus',op:'add',value:1});
 if(scenario.startsWith('condition-'))bonus.push({type:'mechanical',stat:'saving_throw_bonus',op:'add',value:1,condition:{field:'original_boon',op:'eq',value:true}});
 if(scenario==='unsupported-string')bonus.push({type:'mechanical',stat:'saving_throw_bonus',op:'add',value:'1'});
 if(scenario==='tagged-formula')bonus.push({type:'mechanical',stat:'saving_throw_bonus',op:'formula',expr:'1',...(variant==='untagged'?{}:{tag:'ac_formula'})});
 const cls=pin('class',ids.class,'synthetic-lantern-steward',2,{description:'Original class for the consumer workflow.',hit_die:8,spellcasting:null,multiclass:{prerequisites:[],proficiencies_gained:[]},saving_throws:['strength','intelligence'],starting_proficiencies:[],levels:[1,2,3].map(level=>({level,features:[],spellcasting:null}))},[{type:'grant',stat:'save_strength',value:'proficient'},{type:'grant',stat:'save_intelligence',value:'proficient'}]);
 const feat=pin('feat',ids.feat,'synthetic-lantern-poise',3,{description:'Original steady footing while carrying a lantern.'},[{type:'grant',stat:'saving_throw_constitution',value:'proficient'},...bonus]);
 const activeValue=scenario==='neutral'||scenario.startsWith('condition-')||['unsupported-string','tagged-formula'].includes(scenario)?null:scenario==='negative'?-1:scenario==='fractional'||scenario==='manual-recovery'?0.5:scenario==='unsafe-final'?Number.MAX_SAFE_INTEGER:1;
 const active=activeValue===null?[]:[buildCustomActiveEffect({name:'Original steady footing',stat:'saving_throw_bonus',value:activeValue,duration:{type:'special'}})];
 if(scenario==='riders')for(const[index,dice]of['1d4','-1d4'].entries())active.push({...buildCustomActiveEffect({name:`Original rider ${index}`,duration:{type:'special'}}),effects:[{type:'mechanical',stat:'roll_save',op:'add',value:dice}]});
 const state:CharacterState={current_hp:20,temp_hp:0,active_effects:active,original_boon:scenario==='condition-true',notes:'FORBIDDEN_NOTES',quick_notes:'FORBIDDEN_QUICK'};
 if(['riders','manual-recovery','open-con'].includes(scenario))state.concentrating_on={spell_slug:'synthetic-light',spell_name:'Synthetic Light',slot_level:1,started_at:instant};
 const character:CharacterWithSystem={id:ids.character,user_id:ids.owner,system_id:ids.system,campaign_id:null,name:'Original Lantern Courier',visibility:'private',archived:false,level:3,base_stats:{strength:10,dexterity:12,constitution:14,intelligence:10,wisdom:12,charisma:8,hit_die_total:18,spellcasting_ability:10},choices:{classes:[{slug:cls.ref.content_definitions.slug,level:3}]},state,narrative:{motivation:'FORBIDDEN_NARRATIVE'},narrative_rich:{},primary_color:null,created_at:instant,game_systems:{id:ids.system,slug:'dnd-5e-2014',name:'D&D 5e 2014',schema_definition:schema}};
 const refs=[cls.ref,feat.ref],sources=buildCharacterStructuredSources(refs,3,{character,evidence:{status:'complete',character_id:ids.character,system_id:ids.system,refs,grants:[]}}),base={...character.base_stats,level:3};
 const contentEffects=refs.flatMap(ref=>ref.content_definitions.effects),result=evaluate(base,[...contentEffects,...collectActiveEffects(active)],schema,sources,state as Record<string,unknown>);
 if(result.asi?.status!=='available')throw Error('Original modeled complete no-ASI evidence must construct');
 const classData:ClassContentData={[cls.ref.content_definitions.slug]:{slug:cls.ref.content_definitions.slug,data:cls.ref.content_definitions.data as ClassContentData[string]['data']}};
 window.saveBonus.rawPins=[cls.raw,cls.snapshot,feat.raw,feat.snapshot];window.saveBonus.rawState=structuredClone(state);
 return{character,schema,refs,sources,base,state,contentEffects,classData};
}
type Captured={character:ReturnType<typeof useCharacter>;state:ReturnType<typeof useCharacterState>;rolls:ReturnType<typeof useRolls>;con:ReturnType<typeof useConcentration>};
function Consumers(){
 const character=useCharacter(),state=useCharacterState(),rolls=useRolls(),con=useConcentration();
 const[retained,setRetained]=useState<Captured|null>(null),[probeError,setProbeError]=useState<string|null>(null);
 useLayoutEffect(()=>{window.saveBonus.snapshot={stats:character.evalResult.stats,computed:character.evalResult.computed,grants:character.evalResult.grants,bonus:character.savingThrowBonus,mechanics:character.mechanics,state:structuredClone(state.state),pendingCheck:con.pendingCheck,concentration:con.concentration,contentSnapshotsComplete:character.contentSnapshotsComplete,refPins:character.contentRefs.map(ref=>({id:ref.content_id,version:ref.content_version})),asi:character.evalResult.asi}});
 useLayoutEffect(()=>{window.saveBonus.capture=()=>{rolls.assertMechanics({abilities:['constitution'],computed:['proficiency_bonus'],savingThrows:['constitution']});window.saveBonus.captureAdmission={actualGuardPassed:true,pendingCheck:structuredClone(con.pendingCheck)};setRetained({character,state,rolls,con})};return()=>{delete window.saveBonus.capture}},[character,state,rolls,con]);
 useEffect(()=>{window.saveBonus.probe=kind=>{
  try{if(!retained)throw Error('No retained actual provider callback');
   const ability=kind==='con'?'constitution':'wisdom',old=retained.character;
   const resolved=resolveSavingThrowModifier(getConfirmedAbilityModifier(old.evalResult,old.schema,ability),old.evalResult.computed.proficiency_bonus,old.evalResult.grants,`saving_throw_${ability}`,old.savingThrowBonus);
   if(resolved.status!=='available')throw Error(resolved.reason);
   const requirement={abilities:[ability],computed:['proficiency_bonus'],savingThrows:[ability],values:[resolved.modifier]};
   retained.rolls.assertMechanics(requirement);
   const request=kind==='con'?buildConcentrationSaveRequest('Synthetic Light',resolved.modifier,retained.con.pendingCheck!,collectRollModifiers(retained.state.state.active_effects??[],'save')):buildD20RollRequest({kind:'save',label:'Retained Wisdom Save',modifier:resolved.modifier});
   retained.rolls.roll(request,requirement);window.saveBonus.journal.probes.push({kind,outcome:'returned'});
  }catch(error){const message=error instanceof Error?error.message:String(error);setProbeError(message);window.saveBonus.journal.probes.push({kind,outcome:'refused',message})}
 };window.saveBonus.retainedReady=retained!==null;return()=>{delete window.saveBonus.probe}},[retained]);
 return<><aside aria-label="Declared fixture controls" className="flex flex-wrap gap-3 p-4 border-b">
  <button onClick={()=>window.saveBonus.capture?.()}>Capture actual provider callbacks</button>
  <button onClick={()=>con.requestCheck(22)}>Request original CON check</button>
  {probeError&&<p role="alert">{probeError}</p>}
 </aside><SheetPanel/><ConcentrationPrompt/></>;
}
function App(){
 const[f]=useState(original),[effects,setEffects]=useState(f.contentEffects);
 useEffect(()=>{window.saveBonus.mutate=kind=>setEffects([...f.contentEffects,...(kind==='valid'?[{type:'mechanical',stat:'saving_throw_bonus',op:'add',value:1} as Effect]:kind==='untagged'?[{type:'mechanical',stat:'saving_throw_bonus',op:'formula',expr:'1'} as Effect]:[{type:'mechanical',stat:'saving_throw_bonus',op:'add',value:0.5} as Effect])]);return()=>{delete window.saveBonus.mutate}},[f]);
 return<><h1 className="text-xl px-4 pt-4">Offline saving throw bonus acceptance</h1><p className="px-4 text-sm">Original canonical pins; Auth, complete grant read, writes, inbound updates and navigation modeled. Native RNG and actual consumers.</p>
 <CharacterProvider character={f.character} schema={f.schema} contentRefs={f.refs} contentSnapshotsComplete initialState={f.state} initialInventory={[]} initialSpells={[]} classData={f.classData} allEffects={effects} baseStatsWithLevel={f.base} structuredSources={f.sources} isOwner isDm={false} hasSheet maxHp={24} primaryColor={null} onPrimaryColorChange={()=>{}}><Consumers/></CharacterProvider></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
