import { PDFDocument, PDFDict, PDFArray, PDFName, PDFRef } from "npm:pdf-lib@1.17.1";
import jpeg from "npm:jpeg-js@0.4.4";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { RequestError } from "../_shared/request-security.ts";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 4_000_000;
type PngImage = { width: number; height: number; data: Buffer };
// pngjs exposes this runtime API on PNG; its external declarations omit the static member.
const pngSync = (PNG as typeof PNG & { sync: {
  read(bytes: Buffer, options: { checkCRC: boolean }): PngImage;
  write(image: PngImage): Buffer;
} }).sync;
const FORBIDDEN_PDF_NAMES = new Set(["JS", "JavaScript", "Launch", "OpenAction", "AA", "EmbeddedFiles", "RichMedia", "XFA", "AcroForm", "URI", "GoToR", "SubmitForm", "ImportData"]);
/** Structural validation and image normalization; not a malware-scan verdict. */
export async function validateDocument(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new RequestError(413, "DOCUMENT_SIZE_LIMIT");
  try {
    if (mime === "application/pdf") {
      if (!/^%PDF-(1\.[0-7]|2\.0)/.test(new TextDecoder().decode(bytes.slice(0,8))) ||
          !/%%EOF\s*$/.test(new TextDecoder().decode(bytes.slice(-32)))) throw new Error("PDF signature");
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
      if (pdf.getPageCount() < 1 || pdf.getPageCount() > 100) throw new Error("Page limit");
      const seen = new Set<unknown>();
      let nodes = 0;
      const visit = (input: unknown, depth = 0) => {
        const value = input instanceof PDFRef ? pdf.context.lookup(input) : input;
        if (seen.has(value)) return;
        if (++nodes > 20000 || depth > 100) throw new Error("Object limit");
        seen.add(value);
        if (value instanceof PDFName && FORBIDDEN_PDF_NAMES.has(value.decodeText())) throw new Error("Active PDF content");
        if (value instanceof PDFDict) for (const [key, child] of value.entries()) { visit(key,depth+1); visit(child,depth+1); }
        else if (value instanceof PDFArray) for (const child of value.asArray()) visit(child,depth+1);
        else if (value && typeof value === "object" && "dict" in value) visit(value.dict,depth+1);
      };
      for (const [,object] of pdf.context.enumerateIndirectObjects()) visit(object);
      return { bytes, mime, extension: "pdf" };
    }
    if (mime === "image/png") {
      if (bytes.length < 33 || !Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("PNG signature");
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const width=view.getUint32(16),height=view.getUint32(20);
      if (!width || !height || width*height>MAX_PIXELS || bytes[24]>8) throw new Error("Image dimensions");
      let offset=8,headers=0,dataChunks=0,ended=false;
      while(offset<bytes.length){
        if(offset+12>bytes.length)throw new Error("Truncated chunk");
        const length=view.getUint32(offset);
        const type=new TextDecoder().decode(bytes.slice(offset+4,offset+8));
        if(length>bytes.length-offset-12)throw new Error("Chunk length");
        if(offset===8 && (type!=="IHDR"||length!==13))throw new Error("PNG header");
        if(type==="IHDR" && ++headers!==1)throw new Error("Duplicate header");
        if(["acTL","fcTL","fdAT"].includes(type))throw new Error("Animated image");
        if(type==="IDAT")dataChunks++;
        offset+=length+12;
        if(type==="IEND"){
          if(length!==0||offset!==bytes.length)throw new Error("PNG trailer");
          ended=true;
        }
      }
      if(!ended||headers!==1||!dataChunks)throw new Error("Incomplete PNG");
      const image=pngSync.read(Buffer.from(bytes),{checkCRC:true});
      const clean=pngSync.write(image);
      if (clean.byteLength>MAX_DOCUMENT_BYTES) throw new Error("Normalized size");
      return { bytes: new Uint8Array(clean), mime, extension: "png" };
    }
    if (mime === "image/jpeg") {
      if (bytes[0]!==255 || bytes[1]!==216 || bytes[bytes.length-2]!==255 || bytes[bytes.length-1]!==217) throw new Error("JPEG signature");
      const image=jpeg.decode(bytes,{useTArray:true,tolerantDecoding:false,maxResolutionInMP:4,maxMemoryUsageInMB:64});
      const clean=jpeg.encode({width:image.width,height:image.height,data:image.data},90).data;
      if (clean.byteLength>MAX_DOCUMENT_BYTES) throw new Error("Normalized size");
      return { bytes: new Uint8Array(clean), mime, extension: "jpg" };
    }
  } catch { throw new RequestError(422,"INVALID_DOCUMENT_CONTENT"); }
  throw new RequestError(415,"UNSUPPORTED_DOCUMENT_TYPE");
}
