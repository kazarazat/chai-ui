import { afterEach, describe, expect, it, vi } from "vitest";
import { uniqueId } from "./unique-id.js";

afterEach(() => vi.unstubAllGlobals());

describe("uniqueId", () => {
  it("is unique, with or without crypto.randomUUID (missing on pages served over plain http)", () => {
    expect(uniqueId()).not.toBe(uniqueId());
    vi.stubGlobal("crypto", {});
    const a = uniqueId();
    expect(a).toMatch(/^id-\d+-[a-z0-9]+$/);
    expect(uniqueId()).not.toBe(a);
  });
});
