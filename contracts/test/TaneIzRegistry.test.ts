import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, stringToBytes, zeroHash } from "viem";
import { hashEventData, lotIdHash } from "../../packages/shared/src/hash";

describe("TaneIzRegistry", () => {
  async function deployFixture() {
    const [admin, relayer, stranger] = await hre.viem.getWalletClients();
    const registry = await hre.viem.deployContract("TaneIzRegistry", [admin.account.address]);
    const RECORDER_ROLE = await registry.read.RECORDER_ROLE();
    await registry.write.grantRole([RECORDER_ROLE, relayer.account.address]);

    const asRelayer = await hre.viem.getContractAt("TaneIzRegistry", registry.address, {
      client: { wallet: relayer },
    });
    const asStranger = await hre.viem.getContractAt("TaneIzRegistry", registry.address, {
      client: { wallet: stranger },
    });
    const publicClient = await hre.viem.getPublicClient();
    return { registry, asRelayer, asStranger, admin, relayer, stranger, publicClient, RECORDER_ROLE };
  }

  const LOT = lotIdHash("TZ-7K3P9Q");
  const data = {
    schema: "taneiz.event.v1",
    lot: "TZ-7K3P9Q",
    type: "KALITE_ANALIZI",
    grade: "SINIF_2",
    moisture: 11.4,
    ratios: { SAGLIKLI: 0.9123, KIRIK_CATLAK: 0.05 },
  };

  describe("yetki", () => {
    it("rolü olmayan hesap parti kaydedemez", async () => {
      const { asStranger } = await loadFixture(deployFixture);
      await expect(asStranger.write.registerLot([LOT])).to.be.rejectedWith("AccessControlUnauthorizedAccount");
    });

    it("rolü olmayan hesap olay yazamaz", async () => {
      const { asRelayer, asStranger } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      await expect(asStranger.write.recordEvent([LOT, 2, hashEventData(data)])).to.be.rejectedWith(
        "AccessControlUnauthorizedAccount",
      );
    });

    it("admin bile RECORDER_ROLE olmadan yazamaz", async () => {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.write.registerLot([LOT])).to.be.rejectedWith("AccessControlUnauthorizedAccount");
    });

    it("yabancı hesap kendine RECORDER_ROLE veremez", async () => {
      const { asStranger, stranger, RECORDER_ROLE } = await loadFixture(deployFixture);
      await expect(asStranger.write.grantRole([RECORDER_ROLE, stranger.account.address])).to.be.rejectedWith(
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("kayıt", () => {
    it("aynı parti iki kez kaydedilemez", async () => {
      const { asRelayer } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      await expect(asRelayer.write.registerLot([LOT])).to.be.rejectedWith("LotAlreadyRegistered");
    });

    it("kayıtsız partiye olay yazılamaz", async () => {
      const { asRelayer } = await loadFixture(deployFixture);
      await expect(asRelayer.write.recordEvent([LOT, 1, hashEventData(data)])).to.be.rejectedWith("LotNotRegistered");
    });

    it("boş hash reddedilir", async () => {
      const { asRelayer } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      await expect(asRelayer.write.recordEvent([LOT, 1, zeroHash])).to.be.rejectedWith("EmptyHash");
    });

    it("olaylar sırayla saklanır ve event yayınlanır", async () => {
      const { registry, asRelayer, relayer, publicClient } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      const h1 = keccak256(stringToBytes("olay-1"));
      const h2 = hashEventData(data);
      await asRelayer.write.recordEvent([LOT, 1, h1]);
      const tx = await asRelayer.write.recordEvent([LOT, 2, h2]);
      await publicClient.waitForTransactionReceipt({ hash: tx });

      const events = await registry.read.getEvents([LOT]);
      expect(events.length).to.equal(2);
      expect(events[0].dataHash).to.equal(h1);
      expect(events[1].eventType).to.equal(2);
      expect(getAddress(events[1].recorder)).to.equal(getAddress(relayer.account.address));
      expect(await registry.read.eventCount([LOT])).to.equal(2n);

      const logs = await registry.getEvents.EventRecorded();
      expect(logs.length).to.equal(1); // son bloktaki olay
      expect(logs[0].args.index).to.equal(1n);
      expect(logs[0].args.dataHash).to.equal(h2);
    });
  });

  describe("doğrulama", () => {
    it("doğru hash EŞLEŞİR, yanlış hash EŞLEŞMEZ", async () => {
      const { registry, asRelayer } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      await asRelayer.write.recordEvent([LOT, 2, hashEventData(data)]);

      expect(await registry.read.verify([LOT, 0n, hashEventData(data)])).to.equal(true);
      // Anahtar sırası farklı ama içerik aynı → yine eşleşir (kanonik JSON)
      const reordered = JSON.parse(JSON.stringify({ ratios: data.ratios, moisture: 11.4, ...data }));
      expect(await registry.read.verify([LOT, 0n, hashEventData(reordered)])).to.equal(true);
      // Tek alan kurcalandı → eşleşmez
      expect(await registry.read.verify([LOT, 0n, hashEventData({ ...data, grade: "SINIF_1" })])).to.equal(false);
    });

    it("olmayan indeks ve bilinmeyen parti false döner", async () => {
      const { registry, asRelayer } = await loadFixture(deployFixture);
      await asRelayer.write.registerLot([LOT]);
      await asRelayer.write.recordEvent([LOT, 2, hashEventData(data)]);
      expect(await registry.read.verify([LOT, 5n, hashEventData(data)])).to.equal(false);
      expect(await registry.read.verify([lotIdHash("TZ-YOK000"), 0n, hashEventData(data)])).to.equal(false);
    });
  });
});
