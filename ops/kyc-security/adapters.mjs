import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = promisify(execFile);
export const PROJECT_URL = "https://zdpeaxkormwjrgllwalq.supabase.co";
export async function boundedBytes(body, limit = 32 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > limit) {
      body.destroy?.();
      throw Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export function sourceFromEnv(env = process.env, request = fetch) {
  const key = env.MARKETPLACE_STORAGE_WORKER_TOKEN;
  if (!key || !/^[A-Za-z0-9_-]{43,128}$/.test(key))
    throw Error("MARKETPLACE_WORKER_TOKEN_REQUIRED");
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const call = async (args) => {
    const response = await request(
      `${PROJECT_URL}/functions/v1/marketplace-storage-worker`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw Error("SOURCE_RPC_FAILED");
    return response;
  };
  return {
    page: async (after, before) =>
      (await call({ action: "page", after, before })).json(),
    async read(item) {
      if (
        !["kyc-documents", "payslips", "payment-receipts"].includes(
          item.bucket_id,
        ) ||
        typeof item.name !== "string" ||
        item.name
          .split("/")
          .some((x) => !x || x === "." || x === ".." || x.includes("\\"))
      )
        throw Error("INVALID_SOURCE_PATH");
      const response = await call({
        action: "read",
        id: item.id,
        version: item.version,
      });
      if (!response.ok || !response.body) throw Error("SOURCE_READ_FAILED");
      return boundedBytes(response.body, 10 * 1024 * 1024);
    },
    recordScan: async (item, sha, verdict, engine) => {
      await call({
        action: "scan",
        id: item.id,
        version: item.version,
        sha256: sha,
        verdict,
        engine: engine.engine_version,
        definitions_at: engine.definitions_at,
      });
    },
  };
}
export async function destinationFromEnv(env = process.env) {
  for (const key of [
    "KYC_BACKUP_S3_ENDPOINT",
    "KYC_BACKUP_BUCKET",
    "KYC_BACKUP_ACCESS_KEY_ID",
    "KYC_BACKUP_SECRET_ACCESS_KEY",
  ])
    if (!env[key]) throw Error("BACKUP_CONFIGURATION_REQUIRED");
  const endpoint = new URL(env.KYC_BACKUP_S3_ENDPOINT);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw Error("PRIVATE_HTTPS_BACKUP_ENDPOINT_REQUIRED");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.KYC_BACKUP_BUCKET))
    throw Error("INVALID_BACKUP_BUCKET");
  const { S3Client, PutObjectCommand, GetObjectCommand } =
    await import("@aws-sdk/client-s3");
  const client = new S3Client({
    endpoint: endpoint.origin,
    region: env.KYC_BACKUP_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.KYC_BACKUP_ACCESS_KEY_ID,
      secretAccessKey: env.KYC_BACKUP_SECRET_ACCESS_KEY,
    },
    maxAttempts: 3,
  });
  const Bucket = env.KYC_BACKUP_BUCKET;
  const validate = (key) => {
    if (!/^[0-9a-f-]{36}\/(?:[0-9a-f-]{36}|manifest)\.enc$/.test(key))
      throw Error("INVALID_BACKUP_KEY");
  };
  return {
    async put(Key, Body) {
      validate(Key);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body,
          ContentType: "application/octet-stream",
          CacheControl: "no-store",
          IfNoneMatch: "*",
        }),
      );
    },
    async get(Key) {
      validate(Key);
      const response = await client.send(new GetObjectCommand({ Bucket, Key }));
      return boundedBytes(response.Body);
    },
  };
}
export function clamScanner(env = process.env) {
  const args = env.CLAMAV_DATABASE_DIR
    ? ["--database", env.CLAMAV_DATABASE_DIR]
    : [];
  const options = {
    timeout: 60000,
    maxBuffer: 65536,
    env: { ...env, TZ: "UTC" },
  };
  return {
    async preflight() {
      const { stdout } = await run("clamscan", [...args, "--version"], options);
      const parts = stdout.trim().split("/");
      const date = Date.parse(parts.slice(2).join("/") + " UTC");
      if (parts.length < 3 || !Number.isFinite(date))
        throw Error("CLAMAV_DEFINITIONS_UNAVAILABLE");
      // Standard harmless antivirus test signature; never a customer document.
      const probe = Buffer.from(
        "WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=",
        "base64",
      );
      if (
        (await this.scan(Buffer.from("Riverbanc benign scanner self-test"))) !==
          "clean" ||
        (await this.scan(probe)) !== "infected"
      )
        throw Error("ANTIVIRUS_SELF_TEST_FAILED");
      return {
        engine_version: parts.slice(0, 2).join("/"),
        definitions_at: new Date(date).toISOString(),
      };
    },
    async scan(bytes) {
      const directory = await mkdtemp(join(tmpdir(), "riverbanc-kyc-"));
      await chmod(directory, 0o700);
      try {
        const file = join(directory, "evidence.bin");
        await writeFile(file, bytes, { mode: 0o600, flag: "wx" });
        try {
          await run(
            "clamscan",
            [
              ...args,
              "--no-summary",
              "--stdout",
              "--max-filesize=10M",
              "--max-scansize=20M",
              "--max-recursion=8",
              "--alert-exceeds-max=yes",
              "--alert-encrypted=yes",
              file,
            ],
            options,
          );
          return "clean";
        } catch (error) {
          if (error.code === 1) return "infected";
          return "error";
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
