import { describe, expect, it } from "vitest";
import { corsHeadersFor } from "../../../supabase/functions/_shared/cors.ts";

describe("Riverbanc Edge Function CORS", () => {
  it("allows the production apex origin", () => {
    const headers = corsHeadersFor(new Request("https://api.example.test", {
      headers: { origin: "https://riverbanc.co.zm" },
    }), "POST");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://riverbanc.co.zm");
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST");
    expect(headers.Vary).toBe("Origin");
  });

  it("allows the production www origin", () => {
    const headers = corsHeadersFor(new Request("https://api.example.test", {
      headers: { origin: "https://www.riverbanc.co.zm" },
    }), "GET, POST");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://www.riverbanc.co.zm");
  });

  it("does not grant CORS access to an untrusted origin", () => {
    const headers = corsHeadersFor(new Request("https://api.example.test", {
      headers: { origin: "https://attacker.example" },
    }), "POST");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers.Vary).toBe("Origin");
  });

  it("does not accept a lookalike hostname", () => {
    const headers = corsHeadersFor(new Request("https://api.example.test", {
      headers: { origin: "https://riverbanc.co.zm.attacker.example" },
    }), "POST");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("does not emit an allow-origin header for requests without Origin", () => {
    const headers = corsHeadersFor(new Request("https://api.example.test"), "POST");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
