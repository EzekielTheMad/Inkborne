import assert from 'node:assert/strict';
export const scenarios=['neutral','plus-one','negative','independent-adds','condition-false','condition-true','riders','unsupported-string','tagged-formula','fractional','unsafe-final','manual-recovery','retained-save','open-con','retained-print'];
const read=page=>page.evaluate(()=>structuredClone({snapshot:window.saveBonus.snapshot,journal:window.saveBonus.journal,rawPins:window.saveBonus.rawPins,rawState:window.saveBonus.rawState}));
const count=value=>({rng:value.journal.rng.length,logs:value.journal.logs.length,writes:value.journal.writes.length,prints:value.journal.prints.length});
const conButton=page=>page.getByRole('button',{name:'Roll Constitution saving throw',exact:true});
async function unchanged(page,before){const after=await read(page);assert.deepEqual(count(after),count(before));assert.deepEqual(after.rawPins,before.rawPins);assert.deepEqual(after.snapshot.state,before.snapshot.state);return after}
async function roll(page,mode='Roll',ability='Constitution'){
 await page.getByRole('button',{name:`Roll ${ability} saving throw`,exact:true}).click();await page.getByRole('button',{name:mode,exact:true}).click();
 await page.waitForFunction(()=>window.saveBonus.journal.rng.length===window.saveBonus.journal.logs.length);return read(page);
}
async function reach(page,button){await page.getByRole('heading',{name:'Offline saving throw bonus acceptance'}).click();for(let n=0;n<100;n++){if(await button.evaluate(node=>node===document.activeElement))return;await page.keyboard.press('Tab')}throw Error('Actual control not keyboard reachable')}
export async function runSaveBonusScenario(page,scenario,{capture,goto}){
 const checks=[];await page.waitForFunction(()=>window.saveBonus.snapshot&&window.saveBonus.probe&&window.saveBonus.mutate);
 const initial=await read(page);assert.equal(initial.snapshot.mechanics.status,'available');assert.equal(initial.snapshot.contentSnapshotsComplete,true);assert.equal(initial.snapshot.asi.status,'available');
 assert.deepEqual(initial.snapshot.refPins.map(item=>item.version),[2,3]);assert.deepEqual(initial.rawPins.map(item=>item.version),[2,2,3,3]);
 for(const ability of ['strength','dexterity','constitution','intelligence','wisdom','charisma'])assert.ok(Number.isFinite(initial.snapshot.stats[ability]));
 checks.push('actual six abilities, current+immutable pins and complete modeled no-ASI construction');
 if(['neutral','plus-one','negative','independent-adds','condition-false','condition-true'].includes(scenario)){
  const bonus={neutral:0,'plus-one':1,negative:-1,'independent-adds':2,'condition-false':0,'condition-true':1}[scenario];
  assert.deepEqual(initial.snapshot.bonus,{status:'available',bonus});
  for(const[name,base]of[['Strength',0],['Dexterity',1],['Constitution',4],['Intelligence',0],['Wisdom',1],['Charisma',-1]])assert.equal((await page.getByRole('button',{name:`Roll ${name} saving throw`,exact:true}).innerText()).trim().split(/\s+/).at(-1),`${base+bonus>=0?'+':''}${base+bonus}`);
  await reach(page,conButton(page));
  const after=await roll(page);assert.equal(after.journal.rng.length,1);assert.equal(after.journal.logs.length,1);assert.equal(after.journal.rng[0].expression,`1d20${4+bonus>=0?'+':''}${4+bonus}`);assert.equal(after.journal.writes.length,0);
  checks.push('all six exact save values; actual native roll contains one evaluated bonus');
 }else if(scenario==='riders'){
  for(const mode of ['Roll','Advantage','Disadvantage']){const before=await read(page),after=await roll(page,mode),request=after.journal.rng.at(-1);assert.equal(after.journal.rng.length,before.journal.rng.length+1);assert.equal(request.expression,'1d20+5+1d4-1d4');assert.equal(request.mode,mode==='Roll'?undefined:mode.toLowerCase());assert.deepEqual(request.meta.roll_modifiers,[{name:'Original rider 0',dice:'1d4'},{name:'Original rider 1',dice:'-1d4'}])}
  await page.getByRole('button',{name:'Request original CON check'}).click();
  await page.getByRole('button',{name:'Roll CON Save (+5)',exact:true}).click();await page.getByRole('dialog',{name:'Concentration Check'}).waitFor({state:'detached'});
  const after=await read(page),request=after.journal.rng.at(-1),result=after.journal.results.at(-1);assert.equal(request.kind,'concentration');assert.equal(request.expression,'1d20+5+1d4-1d4');assert.equal(after.journal.rng.length,4);assert.equal(after.journal.logs.length,4);
  assert.equal(after.journal.writes.length,result.total>=11?0:1);assert.equal(after.snapshot.concentration===null,result.total<11);
  checks.push('normal/adv/dis/actual CON native RNG; each rider once, actual success/failure recovery');
 }else if(['unsupported-string','tagged-formula','fractional'].includes(scenario)){
  assert.equal(initial.snapshot.bonus.status,'unavailable');assert.equal(await conButton(page).isDisabled(),true);assert.match(await conButton(page).innerText(),/Unavailable/);
  assert.equal(await page.getByRole('button',{name:'Print / Save PDF',exact:true}).isDisabled(),true);await unchanged(page,initial);
  await page.getByRole('button',{name:'Roll Wisdom check',exact:true}).click();await page.getByRole('button',{name:'Roll',exact:true}).click();await page.waitForFunction(()=>window.saveBonus.journal.logs.length===1);
  assert.equal((await read(page)).journal.rng[0].kind,'check');checks.push('native saves/print unavailable before protected effects; independent actual check remains usable');
  if(scenario==='tagged-formula'){
   assert.equal(initial.snapshot.computed.armor_class,11);assert.ok(!Object.hasOwn(initial.snapshot.stats,'saving_throw_bonus'));await capture('tagged');
   await goto('tagged-formula','untagged');await page.waitForFunction(()=>window.saveBonus.snapshot?.bonus.status==='available');
   assert.deepEqual((await read(page)).snapshot.bonus,{status:'available',bonus:1});assert.match(await conButton(page).innerText(),/\+5/);checks.push('distinct original untagged canonical pin evaluates+1; routing/tag preserved in negative fixture');
  }
 }else if(scenario==='unsafe-final'){
  assert.equal(initial.snapshot.bonus.status,'available');assert.equal(initial.snapshot.bonus.bonus,Number.MAX_SAFE_INTEGER);assert.equal(await conButton(page).isDisabled(),true);
  const print=page.getByRole('button',{name:'Print / Save PDF',exact:true});await print.click();assert.equal(await page.getByRole('dialog',{name:'Print preview'}).count(),0);assert.match(await page.getByRole('alert').innerText(),/safe integer/);await unchanged(page,initial);checks.push('affected final unsafe sum refuses model/window/RNG without clamp');
 }else if(scenario==='manual-recovery'){
  await page.getByRole('button',{name:'Request original CON check'}).click();const pending=await read(page);assert.equal(await page.getByRole('button',{name:'Roll CON Save (Unavailable)'}).isDisabled(),true);
  await page.getByRole('button',{name:'Keep',exact:true}).click();await page.getByRole('dialog',{name:'Concentration Check'}).waitFor({state:'detached'});const keep=await read(page);assert.deepEqual(count(keep),count(pending));assert.deepEqual(keep.snapshot.state,pending.snapshot.state);
  await page.getByRole('button',{name:'Request original CON check'}).click();await page.getByRole('button',{name:'Drop',exact:true}).click();await page.getByRole('dialog',{name:'Concentration Check'}).waitFor({state:'detached'});const drop=await read(page);assert.equal(drop.journal.writes.length,1);assert.equal(drop.snapshot.state.concentrating_on,null);assert.equal(drop.journal.rng.length,0);assert.equal(drop.journal.logs.length,0);assert.deepEqual(drop.rawPins,initial.rawPins);checks.push('actual invalid CON Keep zero writes; Drop one original conditional patch, no RNG/log');
 }else if(scenario==='retained-save'){
  await page.getByRole('button',{name:'Capture actual provider callbacks'}).click();await page.waitForFunction(()=>window.saveBonus.retainedReady);assert.equal(await page.evaluate(()=>window.saveBonus.captureAdmission.actualGuardPassed),true);await page.evaluate(()=>window.saveBonus.mutate('valid'));await page.waitForFunction(()=>window.saveBonus.snapshot.bonus.bonus===2);
  const before=await read(page);await page.evaluate(()=>window.saveBonus.probe('save'));await page.waitForFunction(()=>window.saveBonus.journal.probes.length===1);const after=await unchanged(page,before);assert.equal(after.journal.probes[0].outcome,'refused');assert.match(after.journal.probes[0].message,/changed/);assert.deepEqual(before.snapshot.state,initial.snapshot.state);checks.push('declared retained actual provider save command refuses effect-only input drift before RNG/log/write');
 }else if(scenario==='open-con'){
  await page.getByRole('button',{name:'Request original CON check'}).click();await page.getByRole('dialog',{name:'Concentration Check'}).waitFor();await page.evaluate(()=>window.saveBonus.capture());await page.waitForFunction(()=>window.saveBonus.retainedReady);const pending=await read(page);assert.deepEqual(await page.evaluate(()=>window.saveBonus.captureAdmission),{actualGuardPassed:true,pendingCheck:pending.snapshot.pendingCheck});
  await page.evaluate(()=>window.saveBonus.mutate('invalid'));await page.getByRole('button',{name:'Roll CON Save (Unavailable)'}).waitFor();assert.equal(await page.getByRole('button',{name:'Roll CON Save (Unavailable)'}).isDisabled(),true);await unchanged(page,pending);await capture('open-invalid');
  await page.evaluate(()=>window.saveBonus.probe('con'));await page.waitForFunction(()=>window.saveBonus.journal.probes.length===1);const refused=await unchanged(page,pending);assert.equal(refused.journal.probes[0].outcome,'refused');assert.match(refused.journal.probes[0].message,/changed/);
  await page.evaluate(()=>window.saveBonus.mutate('valid'));await page.getByRole('button',{name:'Roll CON Save (+6)',exact:true}).waitFor();const refreshed=await read(page);assert.deepEqual(refreshed.snapshot.pendingCheck,pending.snapshot.pendingCheck);assert.deepEqual(refreshed.snapshot.state,pending.snapshot.state);assert.deepEqual(refreshed.rawPins,pending.rawPins);
  await page.getByRole('button',{name:'Roll CON Save (+6)',exact:true}).click();await page.getByRole('dialog',{name:'Concentration Check'}).waitFor({state:'detached'});const result=await read(page);assert.equal(result.journal.rng.length,1);assert.equal(result.journal.logs.length,1);assert.equal(result.journal.rng[0].expression,'1d20+6');assert.equal(result.journal.writes.length,result.journal.results[0].total>=11?0:1);
  checks.push('real open prompt disables invalid inputs; retained-provider CON probe refuses; fresh valid+6 action legitimate');
 }else if(scenario==='retained-print'){
  await page.getByRole('button',{name:'Print / Save PDF',exact:true}).click();const preview=page.getByRole('dialog',{name:'Print preview'});await preview.waitFor();assert.equal(await preview.getByRole('row',{name:/Constitution 14 \+2 \+5/}).count(),1);await capture('open');
  await page.evaluate(()=>window.saveBonus.mutate('valid'));await page.waitForFunction(()=>window.saveBonus.snapshot.bonus.bonus===2);const before=await read(page);
  await preview.getByRole('button',{name:'Print / Save PDF',exact:true}).click();await preview.waitFor({state:'detached'});await unchanged(page,before);assert.match(await page.getByRole('alert').innerText(),/changed/);checks.push('actual retained product print callback denies changed inputs before window/PDF');
 }else throw Error('Unhandled finite scenario');
 const final=await read(page);assert.deepEqual(final.journal.unexpected,[]);await capture('final');return{scenario,checks,passed:true,journal:final.journal,initial,final,limits:'Original fixtures and modeled loaded read/writes; actual provider/evaluator/consumers and native RNG. Retained CON probe is a declared provider command, not captured DOM handler.'};
}
