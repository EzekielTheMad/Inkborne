import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Proficiencies } from "@/components/sheet/proficiencies";

describe("tool Expertise on the saved sheet", () => {
  it("labels tool Expertise once when proficiency and Expertise both exist", () => {
    render(<Proficiencies grants={[
      { type: "grant", stat: "thieves-tools", value: "proficient" },
      { type: "grant", stat: "thieves-tools", value: "expertise" },
      { type: "grant", stat: "stealth", value: "expertise" },
    ]} />);
    expect(screen.getByText("Thieves Tools (Expertise)")).toBeInTheDocument();
    expect(screen.queryByText("Stealth (Expertise)")).not.toBeInTheDocument();
  });
});
