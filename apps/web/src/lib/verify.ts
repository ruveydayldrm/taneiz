import type { Hex } from "viem";
import { canonicalize, hashEventData, lotIdHash, sha256Hex } from "@taneiz/shared";
import { prisma } from "./prisma";
import { readStored } from "./storage";
import { chainInfo, explorerTxUrl, publicClient, requireRegistry } from "./chain";
import { parseJson } from "./utils";

export type VerifyStatus = "ESLESTI" | "ESLESMEDI" | "BEKLEMEDE" | "HATA";

export interface VerifyResult {
  eventId: string;
  status: VerifyStatus;
  reason: string;
  recomputedHash: string;
  onChainHash: string | null;
  chainIndex: number | null;
  txHash: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
  network: string;
  imageChecks: { kind: string; expected: string; actual: string | null; ok: boolean }[];
  canonical: string;
  checkedAt: string;
}

/**
 * Veritabanındaki GÜNCEL veriden hash'i yeniden hesaplar ve zincirdeki kayıtla karşılaştırır.
 * Kalite analizi olayında görsellerin SHA-256'sı da dosyalardan yeniden hesaplanır.
 */
export async function verifyEvent(eventId: string): Promise<VerifyResult> {
  const ev = await prisma.supplyEvent.findUnique({
    where: { id: eventId },
    include: { lot: { include: { reports: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  if (!ev) throw new Error("Olay bulunamadı");

  const data = parseJson<Record<string, unknown>>(ev.data, {});
  const canonical = canonicalize(data);
  const recomputedHash = hashEventData(data);
  const base = {
    eventId,
    recomputedHash,
    chainIndex: ev.chainIndex,
    txHash: ev.txHash,
    blockNumber: ev.blockNumber,
    explorerUrl: explorerTxUrl(ev.txHash),
    network: chainInfo.label,
    canonical,
    checkedAt: new Date().toISOString(),
  };

  // Görsel bütünlüğü: olay verisindeki SHA-256 ↔ diskteki dosya
  const imageChecks: VerifyResult["imageChecks"] = [];
  const report = ev.lot.reports[0];
  const imgs = data.images as { originals?: string[]; annotated?: string[] } | undefined;
  if (ev.type === "KALITE_ANALIZI" && report && imgs) {
    const files = [
      ...parseJson<{ path: string }[]>(report.images, []).map((f, i) => ({ kind: `Numune ${i + 1}`, f, exp: imgs.originals?.[i] })),
      ...parseJson<{ path: string }[]>(report.annotatedImages, []).map((f, i) => ({
        kind: `Açıklama ${i + 1}`,
        f,
        exp: imgs.annotated?.[i],
      })),
    ];
    for (const { kind, f, exp } of files) {
      let actual: string | null = null;
      try {
        actual = sha256Hex(await readStored(f.path));
      } catch {
        actual = null;
      }
      imageChecks.push({ kind, expected: exp ?? "—", actual, ok: !!exp && actual === exp });
    }
  }

  if (ev.chainIndex === null || ev.chainStatus !== "CONFIRMED") {
    return {
      ...base,
      status: "BEKLEMEDE",
      reason: "Bu kayıt henüz zincire yazılmadı (kuyrukta).",
      onChainHash: null,
      imageChecks,
    };
  }

  try {
    const registry = requireRegistry();
    const id = lotIdHash(ev.lot.publicId);
    const [onChainEvents, matches] = await Promise.all([
      publicClient.readContract({ ...registry, functionName: "getEvents", args: [id] }),
      publicClient.readContract({
        ...registry,
        functionName: "verify",
        args: [id, BigInt(ev.chainIndex), recomputedHash as Hex],
      }),
    ]);
    const onChainHash = onChainEvents[ev.chainIndex]?.dataHash ?? null;
    const imagesOk = imageChecks.every((c) => c.ok);

    if (!matches) {
      return {
        ...base,
        status: "ESLESMEDI",
        reason: "Veritabanındaki veri, zincire mühürlenen hash ile uyuşmuyor. Kayıt sonradan değiştirilmiş.",
        onChainHash,
        imageChecks,
      };
    }
    if (!imagesOk) {
      return {
        ...base,
        status: "ESLESMEDI",
        reason: "Olay verisi eşleşti ancak en az bir görsel dosyası değiştirilmiş veya eksik.",
        onChainHash,
        imageChecks,
      };
    }
    return {
      ...base,
      status: "ESLESTI",
      reason: "Veritabanındaki veriden yeniden hesaplanan hash, zincirdeki kayıtla birebir aynı.",
      onChainHash,
      imageChecks,
    };
  } catch (err) {
    return {
      ...base,
      status: "HATA",
      reason: `Zincire ulaşılamadı: ${(err as Error).message.slice(0, 200)}`,
      onChainHash: null,
      imageChecks,
    };
  }
}
