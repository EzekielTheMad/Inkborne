import assert from "node:assert/strict";
export const passiveScenarios = ["create-basic", "create-subclass", "create-level20", "create-invalid-class", "create-invalid-subclass", "create-invalid-level", "create-leading-level", "create-name101", "create-long", "create-pending", "create-rejected", "create-missing", "create-malformed", "create-uncertain", "create-navigation-failure", "edit-preserved", "edit-absent", "edit-noop", "edit-conflict", "edit-uncertain", "edit-rejected", "edit-admission"];
const calls = page => page.evaluate(()=>window.passiveFeatureHarness.calls);
const nav = page => page.evaluate(()=>window.passiveFeatureHarness.navigation);
const draft = page => page.locator('form input:not([type="hidden"]),form textarea').evaluateAll(nodes=>nodes.map(node=>({name:node.name,value:node.value})));
export async function executePassiveScenario(page, scenario, {layout,keyboardReach,size,capture}) {
 const edit=scenario.startsWith("edit-"), submit=page.getByRole("button",{name:edit?"Save new version":"Create private passive feature",exact:true});
 assert.equal(await page.getByText(/Saving does not attach it to a class or subclass, grant it to a character, or activate its mechanics/).count(),1);
 assert.equal(await page.getByLabel("Name",{exact:true}).getAttribute("maxlength"),"100");
 assert.equal(await page.getByLabel("Description",{exact:true}).getAttribute("maxlength"),"20000");
 if (!edit) {
  assert.equal(await page.getByLabel("Gain level",{exact:true}).getAttribute("maxlength"),"2");
  assert.equal(await page.getByLabel("Class slug",{exact:true}).getAttribute("maxlength"),"100");
  assert.equal(await page.getByLabel("Subclass slug (optional)",{exact:true}).getAttribute("required"),null);
  await page.evaluate(()=>document.querySelector('form').requestSubmit());assert.equal((await calls(page)).length,0,"Native required fields block blank dispatch");
  await page.getByLabel("Name",{exact:true}).fill("Original Lantern Cadence");
  await page.getByLabel("Description",{exact:true}).fill(scenario==="create-long"?"L".repeat(20000):"  Original literal <script>window.passiveInjected=true</script> cadence.\n");
  await page.getByLabel("Class slug",{exact:true}).fill(scenario==="create-invalid-class"?"Bad_Class":"workshop-scout");
  await page.getByLabel("Subclass slug (optional)",{exact:true}).fill(scenario==="create-invalid-subclass"?"bad--slug":scenario==="create-subclass"?"lantern-keeper":"");
  await page.getByLabel("Gain level",{exact:true}).fill(scenario==="create-level20"?"20":scenario==="create-invalid-level"?"21":scenario==="create-leading-level"?"01":"1");
  if (scenario==="create-name101") {
   await page.getByLabel("Name",{exact:true}).evaluate(node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(node,"N".repeat(101));node.dispatchEvent(new Event("input",{bubbles:true}));});
   await page.waitForFunction(()=>{const input=document.querySelector('input[name="name"]');return input.value.length===101&&input.defaultValue.length===101&&new FormData(document.querySelector('form')).get('name').length===101;});
   assert.equal((await page.getByLabel("Name",{exact:true}).inputValue()).length,101);
  }
 } else {
  assert.equal(await page.getByRole("region",{name:"Read-only feature association"}).count(),1);
  const names=await page.locator('form input[name],form textarea[name]').evaluateAll(nodes=>nodes.map(node=>node.name));
  assert.deepEqual(names.sort(),["description","expected_version","id","name"].sort());
  assert.equal(await page.getByText("Legacy workshop label / unverified",{exact:true}).count(),1);
  assert.equal(await page.getByText("Not present",{exact:true}).count(),1);
  if (scenario==="edit-absent") assert.equal(await page.getByText("Not declared",{exact:true}).count(),1);
  if (scenario!=="edit-noop") await page.getByLabel("Description",{exact:true}).fill("Revised original description; metadata only.");
 }
 const originalDraft=await draft(page);await layout(page,size,scenario+":before");await keyboardReach(page,submit);await page.keyboard.press("Enter");
 if (scenario==="create-pending") {
  await page.getByRole("button",{name:"Saving…",exact:true}).waitFor();
  await page.evaluate(()=>{document.querySelector('form').reset();document.querySelector('form').requestSubmit();});
  assert.deepEqual(await draft(page),originalDraft);assert.equal((await calls(page)).length,1);
  await page.evaluate(()=>window.passiveFeatureHarness.releasePending());
 }
 const invalid=scenario.includes("invalid")||scenario==="create-leading-level"||scenario==="create-name101";
 const createUncertain=["create-rejected","create-missing","create-malformed","create-uncertain"].includes(scenario);
 const editBlocked=["edit-conflict","edit-uncertain","edit-rejected"].includes(scenario);
 if (invalid||scenario==="edit-admission") {
  await page.getByRole("alert").waitFor();assert.deepEqual(await nav(page),[]);
  assert.equal(await page.evaluate(()=>window.passiveFeatureHarness.simulatedWrites.length),0);
  if (invalid) {
   const key=scenario.includes("class")?(scenario.includes("subclass")?"subclass":"class"):scenario==="create-name101"?"name":"level";
   await page.waitForFunction(key=>document.activeElement?.id===`feature-${key}`,key);
   assert.equal(await page.locator(`#feature-${key}`).getAttribute("aria-invalid"),"true");
   assert.equal((await calls(page))[0].mapped.success,false);
   if(scenario==="create-name101")assert.equal((await calls(page))[0].fields.name.length,101);
  }
 } else if(createUncertain||editBlocked) {
  await page.getByRole("alert").waitFor();assert.equal(await submit.isDisabled(),true);assert.deepEqual(await nav(page),[]);
  await page.evaluate(()=>document.querySelector('form').reset());assert.deepEqual(await draft(page),originalDraft);
  if(createUncertain) {
   const check=page.getByRole("link",{name:"Check Homebrew",exact:true});await keyboardReach(page,check);await page.keyboard.press("Enter");
   await page.getByRole("status",{name:"Simulated Homebrew check"}).waitFor();assert.equal(await submit.isDisabled(),true);
   assert.equal((await calls(page)).length,1);assert.equal(await page.evaluate(()=>window.passiveFeatureHarness.homebrewChecks),1);
   const ack=page.getByRole("button",{name:"I checked Homebrew; allow another create",exact:true});await keyboardReach(page,ack);await page.keyboard.press("Enter");
   await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);assert.equal((await calls(page)).length,1);
   if(scenario==="create-rejected") {
    await submit.click();await page.waitForFunction(()=>window.passiveFeatureHarness.calls.length===2&&document.querySelector('button[type="submit"]').disabled);
    const attempts=await calls(page);assert.notEqual(attempts[0].simulatedId,attempts[1].simulatedId);assert.equal(await page.evaluate(()=>window.passiveFeatureHarness.simulatedInsertCount),2);
   }
  }
 } else if(scenario==="edit-noop") {
  await page.getByRole("status").filter({hasText:"No changes to save."}).waitFor();assert.equal(await submit.isEnabled(),true);assert.deepEqual(await nav(page),[]);
  assert.equal(await page.evaluate(()=>window.passiveFeatureHarness.simulatedWrites.length),0);
 } else {
  await page.getByRole("status").filter({hasText:"Feature saved as version"}).waitFor();assert.equal(await submit.isDisabled(),true);
  const actionCalls=await calls(page);assert.equal(actionCalls.length,1);assert.equal(actionCalls[0].mapped.success,true);
  const snapshot=await page.evaluate(()=>({writes:window.passiveFeatureHarness.simulatedWrites,raw:window.passiveFeatureHarness.initialRaw,effects:window.passiveFeatureHarness.initialEffects}));
  assert.equal(snapshot.writes.length,1);
  if(edit){assert.deepEqual(snapshot.writes[0].data,{...snapshot.raw,description:actionCalls[0].fields.description});assert.deepEqual(snapshot.writes[0].effects,snapshot.effects);}
  else {assert.equal(snapshot.writes[0].data.feature_type,"passive");assert.deepEqual(snapshot.writes[0].effects,[]);assert.equal(snapshot.writes[0].data.subclass,scenario==="create-subclass"?"lantern-keeper":null);assert.equal(snapshot.writes[0].data.level,scenario==="create-level20"?20:1);assert.equal(snapshot.writes[0].data.description,actionCalls[0].fields.description);if(scenario==="create-long")assert.equal(snapshot.writes[0].data.description.length,20000);}
  assert.deepEqual(await nav(page),[{kind:"router",href:`/homebrew?${edit?"updated":"created"}=${snapshot.writes[0].id}`}]);
  await page.evaluate(()=>document.querySelector('form').requestSubmit());assert.equal((await calls(page)).length,1);
 }
 await page.evaluate(()=>document.querySelector('form').reset());assert.deepEqual(await draft(page),originalDraft);
 await layout(page,size,scenario+":after");
 assert.equal(await page.evaluate(()=>Reflect.has(window,"passiveInjected")),false,"Untrusted draft text must not execute");
 await capture();
 const evidence={calls:await calls(page),navigation:await nav(page),draft:await draft(page),simulatedWrites:await page.evaluate(()=>window.passiveFeatureHarness.simulatedWrites)};
 if(editBlocked){const reload=page.getByRole("button",{name:"Reload latest",exact:true});await keyboardReach(page,reload);await Promise.all([page.waitForEvent("load"),page.keyboard.press("Enter")]);await page.getByLabel("Name",{exact:true}).waitFor();assert.equal(await page.getByLabel("Name",{exact:true}).inputValue(),"Simulated latest feature");assert.equal(await page.locator('input[name="expected_version"]').inputValue(),"4");assert.equal((await calls(page)).length,0);assert.equal(await page.getByRole("button",{name:"Save new version",exact:true}).isEnabled(),true);await layout(page,size,scenario+":reload");}
 return evidence;
}
