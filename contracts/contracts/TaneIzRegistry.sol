// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TaneİZ Kayıt Defteri
/// @notice Buğday partilerinin tedarik olaylarının yalnızca hash'lerini saklar.
/// @dev Zincire kişisel veri veya görsel ASLA yazılmaz; yalnızca keccak256 özetleri tutulur.
contract TaneIzRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct EventRecord {
        uint8 eventType;
        bytes32 dataHash;
        uint64 timestamp;
        address recorder;
    }

    mapping(bytes32 => bool) private _registered;
    mapping(bytes32 => EventRecord[]) private _events;

    event LotRegistered(bytes32 indexed lotIdHash, address indexed recorder, uint256 timestamp);
    event EventRecorded(
        bytes32 indexed lotIdHash,
        uint256 indexed index,
        uint8 eventType,
        bytes32 dataHash,
        address indexed recorder
    );

    error LotAlreadyRegistered(bytes32 lotIdHash);
    error LotNotRegistered(bytes32 lotIdHash);
    error EmptyHash();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(RECORDER_ROLE, ADMIN_ROLE);
    }

    function registerLot(bytes32 lotIdHash) external onlyRole(RECORDER_ROLE) {
        if (lotIdHash == bytes32(0)) revert EmptyHash();
        if (_registered[lotIdHash]) revert LotAlreadyRegistered(lotIdHash);
        _registered[lotIdHash] = true;
        emit LotRegistered(lotIdHash, msg.sender, block.timestamp);
    }

    function recordEvent(bytes32 lotIdHash, uint8 eventType, bytes32 dataHash)
        external
        onlyRole(RECORDER_ROLE)
        returns (uint256 index)
    {
        if (!_registered[lotIdHash]) revert LotNotRegistered(lotIdHash);
        if (dataHash == bytes32(0)) revert EmptyHash();
        index = _events[lotIdHash].length;
        _events[lotIdHash].push(EventRecord(eventType, dataHash, uint64(block.timestamp), msg.sender));
        emit EventRecorded(lotIdHash, index, eventType, dataHash, msg.sender);
    }

    function getEvents(bytes32 lotIdHash) external view returns (EventRecord[] memory) {
        return _events[lotIdHash];
    }

    function eventCount(bytes32 lotIdHash) external view returns (uint256) {
        return _events[lotIdHash].length;
    }

    function isRegistered(bytes32 lotIdHash) external view returns (bool) {
        return _registered[lotIdHash];
    }

    /// @notice Verilen hash, partinin `index` sıradaki olayıyla birebir aynı mı?
    function verify(bytes32 lotIdHash, uint256 index, bytes32 dataHash) external view returns (bool) {
        EventRecord[] storage list = _events[lotIdHash];
        if (index >= list.length) return false;
        return list[index].dataHash == dataHash;
    }
}
