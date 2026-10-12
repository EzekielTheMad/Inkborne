import { describe, expect, it, vi } from "vitest";
import { effectSchema } from "@/lib/schemas/effects";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { companionEnvelope, companionSnapshot, companionRejectedEffects } from "@/tests/fixtures/companions";
import { monsterEnvelope } from "@/tests/fixtures/monsters";
import { npcEnvelope } from "@/tests/fixtures/npcs";

describe("canonical current/snapshot companion admission before defaults", () => {
  it("accepts explicit empty effects and exact own immutable identity without altering bytes", () => {
    const row = companionEnvelope(), snapshot = companionSnapshot(row), before = JSON.stringify({row,snapshot});
    expect(parseContentDefinition(row)).toMatchObject({id:row.id,version:1,content_type:"companion",effects:[],data:row.data});
    expect(parseContentVersionSnapshot(snapshot)).toMatchObject({id:row.id,version:1,content_type:"companion",effects:[],data:row.data});
    expect(JSON.stringify({row,snapshot})).toBe(before);
  });
  it.each(companionRejectedEffects)("refuses independently valid envelope effect %j instead of dropping it", effect => {
    vi.spyOn(console,"error").mockImplementation(()=>{});
    expect(effectSchema.safeParse(effect).success).toBe(true);
    const row = {...companionEnvelope(),effects:[effect]}, snapshot = {...companionSnapshot(),effects_snapshot:[effect]}, before=JSON.stringify({row,snapshot});
    expect(parseContentDefinition(row)).toBeNull(); expect(parseContentVersionSnapshot(snapshot)).toBeNull();
    expect(JSON.stringify({row,snapshot})).toBe(before);
    expect(parseContentDefinition({...monsterEnvelope(),effects:[effect]})).toMatchObject({content_type:"monster",effects:[effect]});
  });
  it.each(["missing-effects","null-effects","object-effects","missing-version","null-version","string-version","zero-version","fraction-version","over-PG-version"])("refuses current/snapshot raw %s before generic defaults", fault => {
    vi.spyOn(console,"error").mockImplementation(()=>{});
    const row:Record<string,unknown>=companionEnvelope(), snapshot:Record<string,unknown>=companionSnapshot();
    if(fault==="missing-effects"){delete row.effects;delete snapshot.effects_snapshot;}
    if(fault==="null-effects"){row.effects=null;snapshot.effects_snapshot=null;}
    if(fault==="object-effects"){row.effects={};snapshot.effects_snapshot={};}
    if(fault==="missing-version"){delete row.version;delete snapshot.version;}
    const invalidVersions:Record<string,unknown>={"null-version":null,"string-version":"1","zero-version":0,"fraction-version":1.5,"over-PG-version":2147483648};
    if(Object.hasOwn(invalidVersions,fault)){row.version=invalidVersions[fault];snapshot.version=invalidVersions[fault];}
    const before=JSON.stringify({row,snapshot});
    expect(parseContentDefinition(row)).toBeNull();expect(parseContentVersionSnapshot(snapshot)).toBeNull();expect(JSON.stringify({row,snapshot})).toBe(before);
  });
  it("refuses invalid data and preserves the existing NPC/ordinary effect behavior",()=>{
    vi.spyOn(console,"error").mockImplementation(()=>{});
    const row={...companionEnvelope(),data:{...companionEnvelope().data,hidden:"unknown"}};
    expect(parseContentDefinition(row)).toBeNull();expect(parseContentVersionSnapshot({...companionSnapshot(),data_snapshot:row.data})).toBeNull();
    expect(parseContentDefinition(npcEnvelope())).toMatchObject({content_type:"npc",effects:[]});
    expect(parseContentDefinition({...npcEnvelope(),effects:[companionRejectedEffects[0]]})).toBeNull();
    expect(parseContentDefinition({...monsterEnvelope(),effects:[companionRejectedEffects[0]]})).toMatchObject({effects:[companionRejectedEffects[0]]});
  });
  it("keeps an exact earlier companion snapshot while a simulated current row changes",()=>{
    const row=companionEnvelope(), frozen=companionSnapshot(row), before=JSON.stringify(frozen);
    row.version=2;row.name="Original changed current";row.data.role="summon";row.data.stat_block.hit_points.average=99;
    expect(parseContentDefinition(row)).toMatchObject({version:2,name:row.name,data:row.data});
    expect(parseContentVersionSnapshot(frozen)).toMatchObject({version:1,name:"Original Workshop Companion",data:{role:"mount",stat_block:{hit_points:{average:18}}}});
    expect(JSON.stringify(frozen)).toBe(before);
  });
});
