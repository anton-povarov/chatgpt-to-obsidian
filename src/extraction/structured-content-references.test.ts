import { describe, expect, it } from "vitest";

import { replaceStructuredContentReferences } from "./structured-content-references";

describe("replaceStructuredContentReferences", () => {
  it("replaces each exact content-reference marker with its name", () => {
    const maxwell =
      'entity["people","James Clerk Maxwell","physicist"]';
    const experiment =
      'entity["historical_event","Michelson–Morley experiment","1887 physics experiment"]';
    const text = `${maxwell} unified electricity and magnetism. ${experiment} tested the theory.`;

    expect(
      replaceStructuredContentReferences(text, [
        {
          matched_text: maxwell,
          start_idx: 369,
          end_idx: 422,
          alt: "Maxwell",
          name: "James Clerk Maxwell",
        },
        {
          matched_text: experiment,
          start_idx: 1046,
          end_idx: 1131,
          alt: "the experiment",
          name: "Michelson–Morley experiment",
        },
      ]),
    ).toBe(
      "James Clerk Maxwell unified electricity and magnetism. Michelson–Morley experiment tested the theory.",
    );
  });

  it("ignores malformed references and absent markers", () => {
    const text = "Keep this text unchanged.";

    expect(
      replaceStructuredContentReferences(text, [
        null,
        { matched_text: "", name: "Empty marker" },
        { matched_text: "unchanged", name: "" },
        { matched_text: "not present", name: "Replacement" },
      ]),
    ).toBe(text);
    expect(replaceStructuredContentReferences(text, undefined)).toBe(text);
  });
});
