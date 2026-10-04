// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { OneAttemptManifest } from "@/e2e/bounded/one-attempt-manifest";
const dirs:string[]=[];
afterEach(()=>{vi.unstubAllEnvs();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true})});
it("requires the scoped approval and never permits a second attempt after cleanup or restart",()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"inkborne-one-attempt-"));dirs.push(dir);
 const runId=randomUUID(),file=path.join(dir,"fixtures.jsonl"),owner=randomUUID(),id=randomUUID();
 const journal=new OneAttemptManifest(file,runId);
 try {
  expect(()=>journal.reserve(owner,"state-controls")).toThrow("approved run gate");
  vi.stubEnv("INKBORNE_STATE_CONTROLS_APPROVED_RUN_ID",runId);
  const attempt=journal.reserve(owner,"state-controls");
  expect(()=>journal.reserve(owner,"again")).toThrow("already consumed");
  journal.recordCreated(attempt.attemptId,id);journal.recordCleaned(id);
  expect(()=>journal.reserve(owner,"again")).toThrow("already consumed");
 }finally{journal.close()}
 const reopened=new OneAttemptManifest(file,runId);
 try{expect(()=>reopened.reserve(owner,"again")).toThrow("already consumed")}finally{reopened.close()}
});
