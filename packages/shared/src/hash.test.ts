import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalize } from "./canonical";
import { hashEventData, lotIdHash, sha256Hex } from "./hash";

test("anahtar sırası hash'i değiştirmez", () => {
  const a = { b: 1, a: { y: [1, 2, { k: "ç" }], x: true } };
  const b = { a: { x: true, y: [1, 2, { k: "ç" }] }, b: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(hashEventData(a), hashEventData(b));
});

test("tek alan değişince hash değişir", () => {
  const a = { grade: "SINIF_2", moisture: 11.4 };
  assert.notEqual(hashEventData(a), hashEventData({ ...a, grade: "SINIF_1" }));
});

test("undefined alanlar atlanır, dizi sırası korunur", () => {
  assert.equal(canonicalize({ a: undefined, b: [2, 1] }), '{"b":[2,1]}');
});

test("JSON gidiş-dönüşü hash'i korur", () => {
  const a = { ratios: { SAGLIKLI: 0.9312, KUFLU: 0.0104 }, at: "2026-07-01T08:00:00.000Z" };
  assert.equal(hashEventData(JSON.parse(JSON.stringify(a))), hashEventData(a));
});

test("lotIdHash ve sha256 sabit uzunlukta", () => {
  assert.match(lotIdHash("TZ-7K3P9Q"), /^0x[0-9a-f]{64}$/);
  assert.match(sha256Hex(new Uint8Array([1, 2, 3])), /^0x[0-9a-f]{64}$/);
});
