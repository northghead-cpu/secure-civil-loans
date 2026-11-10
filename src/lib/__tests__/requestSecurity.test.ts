import { describe, it, expect } from "vitest";
import { readBoundedText } from "../../../supabase/functions/_shared/request-security";

describe("bounded request streams", () => {
  it("counts UTF-8 bytes, including chunked bodies without a length header", async () => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode("ééé")); controller.close();
    } }));
    await expect(readBoundedText(response, 4)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects invalid UTF-8 and oversized declared lengths", async () => {
    await expect(readBoundedText(new Response(new Uint8Array([0xff])), 4)).rejects.toMatchObject({ status: 400 });
    await expect(readBoundedText(new Response("", { headers: { "content-length": "500" } }), 4)).rejects.toMatchObject({ status: 413 });
  });
  it("times out a stalled stream and cancels it", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    await expect(readBoundedText(response, 4, 10)).rejects.toMatchObject({ status: 408 });
    expect(cancelled).toBe(true);
  });
});
