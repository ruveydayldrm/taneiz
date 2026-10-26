/** contracts/contracts/TaneIzRegistry.sol için ABI (kontrat değişirse güncelleyin). */
export const registryAbi = [
  {
    type: "function",
    name: "registerLot",
    stateMutability: "nonpayable",
    inputs: [{ name: "lotIdHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "recordEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "lotIdHash", type: "bytes32" },
      { name: "eventType", type: "uint8" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [{ name: "index", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEvents",
    stateMutability: "view",
    inputs: [{ name: "lotIdHash", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "eventType", type: "uint8" },
          { name: "dataHash", type: "bytes32" },
          { name: "timestamp", type: "uint64" },
          { name: "recorder", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "lotIdHash", type: "bytes32" },
      { name: "index", type: "uint256" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "lotIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "eventCount",
    stateMutability: "view",
    inputs: [{ name: "lotIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "LotRegistered",
    inputs: [
      { name: "lotIdHash", type: "bytes32", indexed: true },
      { name: "recorder", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EventRecorded",
    inputs: [
      { name: "lotIdHash", type: "bytes32", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "eventType", type: "uint8", indexed: false },
      { name: "dataHash", type: "bytes32", indexed: false },
      { name: "recorder", type: "address", indexed: true },
    ],
  },
] as const;
