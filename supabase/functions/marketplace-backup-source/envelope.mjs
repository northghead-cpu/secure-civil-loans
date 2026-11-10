import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  createPrivateKey,
  publicEncrypt,
  privateDecrypt,
  randomBytes,
  constants,
} from "node:crypto";
export const FORMAT = "Riverbanc-Marketplace-KYC-Backup-v1";
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function publicKeyId(pem) {
  if (typeof pem !== "string" || pem.includes("PRIVATE KEY"))
    throw Error("PUBLIC_KEY_ONLY");
  const key = createPublicKey(pem);
  if (
    key.asymmetricKeyType !== "rsa" ||
    key.asymmetricKeyDetails.modulusLength < 3072
  )
    throw Error("RSA_3072_PUBLIC_KEY_REQUIRED");
  return digest(key.export({ type: "spki", format: "der" }));
}
export function seal(bytes, publicKey, context) {
  const header = { format: FORMAT, key_id: publicKeyId(publicKey), ...context };
  if (
    header.format !== FORMAT ||
    !["object", "manifest"].includes(header.kind) ||
    typeof header.run_id !== "string" ||
    typeof header.object_id !== "string"
  )
    throw Error("INVALID_CONTEXT");
  const aad = Buffer.from(JSON.stringify(header));
  const key = randomBytes(32),
    nonce = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.from(
      JSON.stringify({
        header,
        nonce: nonce.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        wrapped_key: publicEncrypt(
          {
            key: publicKey,
            oaepHash: "sha256",
            padding: constants.RSA_PKCS1_OAEP_PADDING,
          },
          key,
        ).toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      }),
    );
  } finally {
    key.fill(0);
  }
}
const decode = (value) => {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw Error("INVALID_ENVELOPE");
  return Buffer.from(value, "base64");
};
export function unseal(envelope, privateKey, expectedContext) {
  if (envelope.length > 32 * 1024 * 1024) throw Error("ENVELOPE_TOO_LARGE");
  const data = JSON.parse(envelope.toString("utf8"));
  if (
    !data.header ||
    data.header.format !== FORMAT ||
    !["object", "manifest"].includes(data.header.kind)
  )
    throw Error("INVALID_ENVELOPE");
  if (
    Object.entries(expectedContext).some(
      ([key, value]) => data.header[key] !== value,
    )
  )
    throw Error("CONTEXT_MISMATCH");
  const recovery = createPrivateKey(privateKey);
  if (
    data.header.key_id !==
    publicKeyId(
      createPublicKey(recovery).export({ type: "spki", format: "pem" }),
    )
  )
    throw Error("RECOVERY_KEY_MISMATCH");
  const key = privateDecrypt(
    {
      key: recovery,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    decode(data.wrapped_key),
  );
  try {
    const nonce = decode(data.nonce),
      tag = decode(data.tag);
    if (key.length !== 32 || nonce.length !== 12 || tag.length !== 16)
      throw Error("INVALID_ENVELOPE");
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(JSON.stringify(data.header)));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(decode(data.ciphertext)),
      decipher.final(),
    ]);
  } finally {
    key.fill(0);
  }
}
