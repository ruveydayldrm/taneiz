import { keccak256, sha256, stringToBytes, type Hex } from "viem";
import { canonicalize } from "./canonical";

/** Olay verisi → kanonik JSON → keccak256. Kayıt ve doğrulama bu tek fonksiyonu kullanır. */
export function hashEventData(data: unknown): Hex {
  return keccak256(stringToBytes(canonicalize(data)));
}

/** Zincirde parti kimliği olarak publicId'nin keccak256'sı kullanılır (ör. TZ-7K3P9Q). */
export function lotIdHash(publicId: string): Hex {
  return keccak256(stringToBytes(publicId));
}

/** Görseller SHA-256 ile hash'lenir; sonuç olay verisine eklenir. */
export function sha256Hex(bytes: Uint8Array): Hex {
  return sha256(bytes);
}
