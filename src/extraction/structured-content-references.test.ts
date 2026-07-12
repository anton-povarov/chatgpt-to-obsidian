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

  it("renders grouped webpage citations with deduplicated clean links", () => {
    const citation = "citeturn0search3turn0search2";

    expect(
      replaceStructuredContentReferences(`Supported claim. ${citation}`, [
        {
          matched_text: citation,
          type: "grouped_webpages",
          name: null,
          alt: "([GitHub](https://github.com/apple/containerization?utm_source=chatgpt.com))",
          safe_urls: [
            "https://github.com/apple/containerization",
            "https://github.com/apple/containerization?utm_source=chatgpt.com",
            "https://opensource.apple.com/projects/container",
            "https://opensource.apple.com/projects/container?utm_source=chatgpt.com",
          ],
        },
      ]),
    ).toBe(
      "Supported claim. ([github.com](https://github.com/apple/containerization), [opensource.apple.com](https://opensource.apple.com/projects/container))",
    );
  });

  it("uses alt text when available and readable raw content otherwise", () => {
    const described = "new_typeopaque-id";
    const unknown = "citeturn0search3turn0search2";

    expect(
      replaceStructuredContentReferences(`${described} then ${unknown}`, [
        { matched_text: described, type: "new_type", alt: "Readable description" },
      ]),
    ).toBe(
      "Readable description then cite|turn0search3|turn0search2",
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
        { matched_text: " ", type: "sources_footnote", name: null },
      ]),
    ).toBe(text);
    expect(replaceStructuredContentReferences(text, undefined)).toBe(text);
  });
});
