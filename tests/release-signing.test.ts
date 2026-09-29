import { describe, it, expect } from "vitest";
// @ts-expect-error Build scripts are plain JavaScript.
import { macSigningConfig } from "../scripts/mac-signing.mjs";

describe("public Mac release signing", () => {
  it("refuses a requested signed release when credentials are missing", () => {
    expect(() =>
      macSigningConfig({ JEEVES_SIGN_MAC: "true" }, "darwin"),
    ).toThrow("Signed Mac release requires");
  });
  it("does not silently publish unsigned when the signing flag is misspelled", () => {
    expect(() =>
      macSigningConfig({ JEEVES_SIGN_MAC: "tru" }, "darwin"),
    ).toThrow("must be true or false");
  });
  it("rejects a development identity even when notarization credentials exist", () => {
    expect(() =>
      macSigningConfig(
        {
          JEEVES_SIGN_MAC: "true",
          JEEVES_MAC_IDENTITY: "Apple Development: Example",
          JEEVES_NOTARY_KEY_FILE: "/key.p8",
          JEEVES_NOTARY_KEY_ID: "EXAMPLE",
          JEEVES_NOTARY_ISSUER_ID: "EXAMPLE",
        },
        "darwin",
      ),
    ).toThrow("Developer ID Application");
  });
  it("keeps ordinary contributor builds available without signing credentials", () => {
    expect(macSigningConfig({}, "darwin")).toBeNull();
    expect(macSigningConfig({ JEEVES_SIGN_MAC: "false" }, "darwin")).toBeNull();
    expect(macSigningConfig({ JEEVES_SIGN_MAC: "true" }, "linux")).toBeNull();
  });
});
