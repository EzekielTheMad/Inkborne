import { writeFileSync } from "node:fs";
import { readRunnerSettings } from "../e2e/bounded/settings";
import { verifyExistingAccounts } from "../e2e/bounded/runtime";
async function main() {
 const settings=readRunnerSettings("C:/Projects/Inkborne/.env.local");
 const accounts=await verifyExistingAccounts(settings);
 try {
  const {data:system,error:sysError}=await accounts.primary.from("game_systems").select("id").eq("slug","dnd-5e-2014").eq("status","published").single();
  if(sysError||!system)throw new Error("Approved published system unavailable");
  const {data,error}=await accounts.primary.from("content_definitions").select("id,slug,name,version,content_type,source,scope,data,effects").eq("system_id",system.id).eq("source","srd").eq("scope","platform").in("slug",["wizard","fighter","barbarian","expeditious-retreat","protection-from-evil-and-good"]);
  if(error)throw new Error("Accessible definitions read failed");
  writeFileSync("C:/Users/kaios/Documents/Codex/2026-10-02/task-5/inkborne-ninth-catalog-readonly.json",JSON.stringify({systemId:system.id,definitions:data},null,2));
  console.log(JSON.stringify({targetVerified:true,accountsVerified:true,definitions:data?.map(row=>({slug:row.slug,version:row.version,type:row.content_type,source:row.source,scope:row.scope}))},null,2));
 }finally{await accounts.close()}
}
main().catch(()=>{console.error("Read-only state-controls preflight failed; no fixtures created");process.exitCode=1});
