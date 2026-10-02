import { describe, expect, it } from "vitest";
import { activeFeatureSlugs, fixedLanguages, isAsiChoiceComplete, isChoiceComplete, resolveDefinitionChoices } from "@/lib/builder/choice-validation";
import { getBuilderStepStatus, type BuilderStatusRef } from "@/lib/builder/step-status";
import type { ChoiceEffect } from "@/lib/types/effects";

const choice: ChoiceEffect = { type: "choice", choose: 1, from: "all_languages", grant_type: "proficiency", choice_id: "extra-language" };
function pin(type: string, slug: string, data: Record<string, unknown> = {}, effects: ChoiceEffect[] = []): BuilderStatusRef {
  return { content_id: slug, content_version: 1, content_definitions: { id: slug, slug, name: slug, content_type: type, version: 1, data, effects } };
}
describe("saved category and level validation", () => {
  it("uses the accessible language vocabulary, excludes grants, and never guesses unknown categories", () => {
    expect(isChoiceComplete(choice, ["elvish"], ["common", "elvish"], ["common"])).toBe(true);
    expect(isChoiceComplete(choice, ["common"], ["common", "elvish"], ["common"])).toBe(false);
    expect(isChoiceComplete(choice, ["removed"], ["common", "elvish"])).toBe(false);
    expect(isChoiceComplete(choice, ["elvish"])).toBe(false);
    expect(isChoiceComplete({ ...choice, from: "unknown_category" }, ["elvish"], ["elvish"])).toBe(false);
    expect(resolveDefinitionChoices({ effects: [choice] }, ["common", "elvish"], ["common"]).effects[0].from).toEqual(["elvish"]);
  });
  it("reads language grant values as well as fixed racial data", () => {
    expect(fixedLanguages([{ data: { languages: ["common"] }, effects: [{type:"grant",stat:"language",value:"elvish"}] }])).toEqual(["common", "elvish"]);
  });
  it("requires exactly two valid, distinct ability points", () => {
    expect(isAsiChoiceComplete({ mode:"asi", allocations:[{ability:"strength",amount:2}] })).toBe(true);
    expect(isAsiChoiceComplete({ mode:"asi", allocations:[{ability:"strength",amount:1}] })).toBe(false);
    expect(isAsiChoiceComplete({ mode:"asi", allocations:[null] } as unknown as Parameters<typeof isAsiChoiceComplete>[0])).toBe(false);
    expect(isAsiChoiceComplete({ mode:"asi", allocations:[{ability:"strength",amount:1},{ability:"strength",amount:1}] })).toBe(false);
  });
  it("requires active feature choices from their historical pins, ignoring future levels", () => {
    const cls=pin("class","fighter",{levels:[{level:1,features:["training"]},{level:4,features:["asi"]}]});
    const feature=pin("feature","training",{},[{...choice,from:["old-option"]}]);
    const choices={classes:[{slug:"fighter",level:1}],resolved_choices:{"extra-language":["old-option"]}};
    expect(activeFeatureSlugs(cls.content_definitions,1)).toEqual(["training"]);
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls])).toBe("in_progress");
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls,feature])).toBe("complete");
    expect(getBuilderStepStatus("class",{...choices,resolved_choices:{"extra-language":["current-catalog-option"]}}, {},undefined,[cls,feature])).toBe("in_progress");
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls,feature,feature])).toBe("in_progress");
  });
  it("requires exact ASI feat provenance and version", () => {
    const cls=pin("class","fighter",{levels:[{level:4,features:["asi"]}]});
    const asi=pin("feature","asi",{feature_type:"asi"});
    const feat={...pin("feat","old-feat"),context:{source:"asi_feat",feature_slug:"asi"},choice_source:"choice:asi:grant"};
    const choices={classes:[{slug:"fighter",level:4}],asi_choices:{asi:{mode:"feat" as const,featId:"old-feat",featVersion:1,featName:"Historical Feat"}}};
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls,asi])).toBe("in_progress");
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls,asi,feat])).toBe("complete");
    expect(getBuilderStepStatus("class",choices,{},undefined,[cls,asi,{...feat,content_version:2}])).toBe("in_progress");
  });
  it("does not let a fighting-style gate select itself",()=>{
    const cls=pin("class","fighter",{levels:[{level:1,features:["style"]}]});
    const style=pin("feature","style",{class:"fighter",feature_type:"fighting_style"});
    style.content_definitions.name="Fighting Style";
    expect(getBuilderStepStatus("class",{classes:[{slug:"fighter",level:1}],resolved_choices:{style:["style"]}}, {},undefined,[cls,style])).toBe("in_progress");
  });
  it("requires race and subrace trait pins, including their choices", () => {
    const race=pin("race","human",{traits:["versatility"],languages:["common"]});
    const trait=pin("trait","versatility",{},[choice]);
    const choices={race:"human",resolved_choices:{"extra-language":["elvish"]}};
    expect(getBuilderStepStatus("race",choices,{},undefined,[race], ["common","elvish"])).toBe("in_progress");
    expect(getBuilderStepStatus("race",choices,{},undefined,[race,trait], ["common","elvish"])).toBe("complete");
    expect(getBuilderStepStatus("race",{...choices,resolved_choices:{"extra-language":["common"]}}, {},undefined,[race,trait], ["common","elvish"])).toBe("in_progress");
  });
});
