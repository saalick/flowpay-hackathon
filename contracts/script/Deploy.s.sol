// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { TripAccount } from "../src/TripAccount.sol";
import { TripAccountFactory } from "../src/TripAccountFactory.sol";
import { LPRegistry } from "../src/LPRegistry.sol";
import { FlowSettlement } from "../src/FlowSettlement.sol";
import { TreasuryVault } from "../src/TreasuryVault.sol";

/// @notice Deploys the full FlowPay stack. For the hackathon demo one server
///         EOA holds every role (admin/orchestrator/confirmer/quoteSigner/
///         treasury/deployer). Readme notes multisig in production.
///
/// Required env:
///   SERVER_PRIVATE_KEY   — the one key used for all roles
///   USDC_ADDRESS         — Circle USDC on Fuji
///   DEMO_MERCHANT_ID     — bytes32 (optional; default keccak256("thai-coffee-01"))
///   OFFRAMP_DEST         — allowlisted offramp dest (defaults to SERVER)
contract Deploy is Script {
    function run() external {
        uint256 serverPk = vm.envUint("SERVER_PRIVATE_KEY");
        address server = vm.addr(serverPk);
        address usdc = vm.envAddress("USDC_ADDRESS");
        address offrampDest = vm.envOr("OFFRAMP_DEST", server);
        bytes32 merchantId = vm.envOr(
            "DEMO_MERCHANT_ID",
            keccak256("thai-coffee-01")
        );

        console2.log("deployer / server EOA:", server);
        console2.log("usdc:", usdc);

        vm.startBroadcast(serverPk);

        TreasuryVault vault = new TreasuryVault(usdc, server);
        FlowSettlement settlement = new FlowSettlement(
            usdc, address(vault), server, server, server, server
        );
        LPRegistry registry = new LPRegistry(usdc, address(settlement));
        settlement.setLpRegistry(address(registry));

        TripAccount tripImpl = new TripAccount();
        TripAccountFactory factory = new TripAccountFactory(address(tripImpl), address(settlement), usdc);

        settlement.registerMerchant(merchantId, server);
        settlement.setOfframp(keccak256("sim-offramp-01"), offrampDest, true);

        vm.stopBroadcast();

        console2.log("TreasuryVault:", address(vault));
        console2.log("FlowSettlement:", address(settlement));
        console2.log("LPRegistry:", address(registry));
        console2.log("TripAccount impl:", address(tripImpl));
        console2.log("TripAccountFactory:", address(factory));
        console2.log("Demo merchantId (bytes32):");
        console2.logBytes32(merchantId);

        string memory json = "deployment";
        vm.serializeAddress(json, "treasury", address(vault));
        vm.serializeAddress(json, "settlement", address(settlement));
        vm.serializeAddress(json, "lpRegistry", address(registry));
        vm.serializeAddress(json, "tripImplementation", address(tripImpl));
        vm.serializeAddress(json, "tripFactory", address(factory));
        vm.serializeAddress(json, "usdc", usdc);
        vm.serializeBytes32(json, "demoMerchantId", merchantId);
        string memory out = vm.serializeUint(json, "chainId", block.chainid);

        string memory path = string.concat(
            vm.projectRoot(),
            "/deployments/fuji.deployed.json"
        );
        vm.writeFile(path, out);
        console2.log("Wrote:", path);
    }
}
