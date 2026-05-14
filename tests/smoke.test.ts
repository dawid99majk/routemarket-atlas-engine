import { describe, expect, it } from "vitest";
import { atlasCoreVersion } from "../packages/atlas-core/src/index.js";

describe("workspace smoke test", () => {
  it("loads atlas core", () => {
    expect(atlasCoreVersion).toBe("0.1.0");
  });
});
