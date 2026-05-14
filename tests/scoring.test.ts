import { describe, expect, it } from "vitest";
import { scoreTopic } from "../packages/atlas-core/src/index.js";

describe("topic scoring", () => {
  it("scores GPX route topics as research candidates", () => {
    const topic = scoreTopic({
      title: "Albania motorcycle route GPX",
      category: "motorcycle",
      region: "Albania",
      language: "en",
      sourceCount: 5
    });

    expect(topic.id).toBe("albania-motorcycle-route-gpx");
    expect(topic.score).toBeGreaterThan(60);
    expect(topic.recommendation).toMatch(/build_now|research_more/);
  });
});
