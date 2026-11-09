import { supabase } from "@/integrations/supabase/client";

type Bucket = "kyc-documents" | "payment-receipts";
type Mode = "view" | "download" | "print";

/** Fetch using the current JWT/RLS rules; never mint a shareable bearer URL. */
export async function openPrivateStorageDocument(
  bucket: Bucket,
  path: string,
  mode: Mode = "view",
  downloadName = "Riverbanc_document",
) {
  const popup = mode === "download" ? null : window.open("about:blank", "_blank");
  if (mode !== "download" && !popup) throw new Error("Allow pop-ups to view this document.");
  if (popup) {
    popup.opener = null;
    popup.document.body.textContent = "Opening private document…";
  }
  let objectUrl: string | undefined;
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path, {}, { cache: "no-store" });
    if (error || !data || !data.size || data.size > 10 * 1024 * 1024 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(data.type)) {
      throw new Error("Document access is unavailable. Check your session or contact an administrator.");
    }
    if (popup?.closed) return;
    objectUrl = URL.createObjectURL(data);
    if (mode === "download") {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadName;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } else if (popup) {
      popup.location.href = objectUrl;
    }
    const temporaryUrl = objectUrl;
    setTimeout(() => URL.revokeObjectURL(temporaryUrl), 60_000);
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    popup?.close();
    throw error;
  }
}
