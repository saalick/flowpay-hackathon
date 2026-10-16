// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { TripAccount } from "../src/TripAccount.sol";
import { TripAccountFactory } from "../src/TripAccountFactory.sol";
import { LPRegistry } from "../src/LPRegistry.sol";
import { FlowSettlement } from "../src/FlowSettlement.sol";
import { TreasuryVault } from "../src/TreasuryVault.sol";
import { FlowTypes } from "../src/interfaces/Types.sol";
import { ITripAccount } from "../src/interfaces/ITripAccount.sol";
import { IFlowSettlement } from "../src/interfaces/IFlowSettlement.sol";
import { ILPRegistry } from "../src/interfaces/ILPRegistry.sol";

contract FlowPayTest is Test {
    MockUSDC usdc;
    TreasuryVault vault;
    FlowSettlement settlement;
    LPRegistry registry;
    TripAccountFactory factory;
    TripAccount tripImpl;

    uint256 quoteSignerPk = 0xA11CE;
    uint256 tourist1Pk = 0x7001;
    uint256 agent1Pk = 0xA601;
    address quoteSigner;
    address tourist1;
    address agent1;

    address admin = address(0xA1);
    address orchestrator = address(0xA2);
    address confirmer = address(0xA3);
    address lp1 = address(0xB1);
    address lp2 = address(0xB2);
    address merchant = address(0xC1);

    bytes32 merchantId = keccak256("thai-coffee-01");
    bytes32 offrampId = keccak256("sim-offramp-01");
    address offrampDest = address(0xDEAD1);

    bytes3 constant THB = bytes3("THB");

    function setUp() public {
        quoteSigner = vm.addr(quoteSignerPk);
        tourist1 = vm.addr(tourist1Pk);
        agent1 = vm.addr(agent1Pk);

        usdc = new MockUSDC();
        vault = new TreasuryVault(address(usdc), admin);
        settlement = new FlowSettlement(
            address(usdc), address(vault), quoteSigner, admin, orchestrator, confirmer
        );
        registry = new LPRegistry(address(usdc), address(settlement));
        vm.prank(admin);
        settlement.setLpRegistry(address(registry));

        tripImpl = new TripAccount();
        factory = new TripAccountFactory(address(tripImpl), address(settlement), address(usdc));

        vm.startPrank(admin);
        settlement.registerMerchant(merchantId, merchant);
        settlement.setOfframp(offrampId, offrampDest, true);
        vm.stopPrank();

        usdc.mint(tourist1, 10_000e6);
        usdc.mint(lp1, 100_000e6);
        usdc.mint(lp2, 100_000e6);
    }

    function _mkTrip(address who, uint256 budget, uint256 perTx) internal returns (TripAccount) {
        bytes32 salt = keccak256(abi.encode(who, "trip-1"));
        address acc = factory.createTrip(who, budget, perTx, uint64(block.timestamp + 7 days), salt);
        return TripAccount(acc);
    }

    function _signQuote(FlowTypes.Quote memory q) internal view returns (bytes memory) {
        bytes32 QUOTE_TYPEHASH = keccak256(
            "Quote(bytes32 orderRef,bytes32 merchantId,address payer,uint256 fiatAmount,bytes3 currency,uint256 usdcAmount,uint64 expiresAt)"
        );
        bytes32 structHash = keccak256(abi.encode(
            QUOTE_TYPEHASH, q.orderRef, q.merchantId, q.payer, q.fiatAmount, q.currency, q.usdcAmount, q.expiresAt
        ));
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("FlowPay-Settlement"), keccak256("1"), block.chainid, address(settlement)
        ));
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(quoteSignerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _mkQuote(address payer, uint256 fiat, uint256 usdcAmt, bytes32 orderRef) internal view returns (FlowTypes.Quote memory) {
        return FlowTypes.Quote({
            orderRef: orderRef,
            merchantId: merchantId,
            payer: payer,
            fiatAmount: fiat,
            currency: THB,
            usdcAmount: usdcAmt,
            expiresAt: uint64(block.timestamp + 60)
        });
    }

    function _lpStake(address lp, uint256 amount) internal {
        vm.startPrank(lp);
        registry.register(THB, "PROMPTPAY", 50);
        usdc.approve(address(registry), amount);
        registry.stake(amount);
        vm.stopPrank();
    }

    function _createOrder(TripAccount trip, uint256 usdcAmt, bytes32 orderRef) internal returns (bytes32) {
        FlowTypes.Quote memory q = _mkQuote(address(trip), usdcAmt * 36 / 10, usdcAmt, orderRef);
        bytes memory sig = _signQuote(q);
        vm.prank(tourist1);
        return trip.pay(q, sig);
    }

    // --- Factory ---
    function test_FactoryCreateTripPredicts() public {
        bytes32 salt = keccak256("trip-x");
        address predicted = factory.predict(tourist1, salt);
        address actual = factory.createTrip(tourist1, 100e6, 50e6, uint64(block.timestamp + 1 days), salt);
        assertEq(predicted, actual);
    }

    function test_FactoryInitializesTrip() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        assertEq(trip.owner(), tourist1);
        assertEq(trip.tripBudget(), 300e6);
        assertEq(trip.perTxCap(), 50e6);
        assertEq(trip.remainingBudget(), 300e6);
    }

    // --- TripAccount ---
    function test_TripPayHappy() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        FlowTypes.Quote memory q = _mkQuote(address(trip), 18000, 5e6, keccak256("ord-1"));
        vm.prank(tourist1);
        bytes32 orderId = trip.pay(q, _signQuote(q));
        assertEq(trip.spent(), 5e6);
        assertEq(uint256(settlement.orderStatus(orderId)), uint256(FlowTypes.OrderStatus.Open));
    }

    function test_TripPayRevertsOnPerTxCap() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 10e6);
        usdc.mint(address(trip), 50e6);
        FlowTypes.Quote memory q = _mkQuote(address(trip), 50000, 11e6, keccak256("ord-perTx"));
        vm.prank(tourist1);
        vm.expectRevert(ITripAccount.PerTxCapExceeded.selector);
        trip.pay(q, _signQuote(q));
    }

    function test_TripPayRevertsOnBudget() public {
        TripAccount trip = _mkTrip(tourist1, 20e6, 15e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        FlowTypes.Quote memory q1 = _mkQuote(address(trip), 50000, 15e6, keccak256("ord-A"));
        vm.prank(tourist1);
        trip.pay(q1, _signQuote(q1));
        FlowTypes.Quote memory q2 = _mkQuote(address(trip), 50000, 10e6, keccak256("ord-B"));
        vm.prank(tourist1);
        vm.expectRevert(ITripAccount.BudgetExceeded.selector);
        trip.pay(q2, _signQuote(q2));
    }

    function test_TripPayRevertsOnExpiry() public {
        TripAccount trip = _mkTrip(tourist1, 100e6, 50e6);
        usdc.mint(address(trip), 50e6);
        vm.prank(tourist1);
        trip.setLimits(100e6, 50e6, uint64(block.timestamp - 1));
        FlowTypes.Quote memory q = _mkQuote(address(trip), 5000, 5e6, keccak256("ord-expired"));
        vm.prank(tourist1);
        vm.expectRevert(ITripAccount.TripExpired.selector);
        trip.pay(q, _signQuote(q));
    }

    function test_TripAgentCapEnforced() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 100e6);
        _lpStake(lp1, 1000e6);
        vm.prank(tourist1);
        trip.setAgent(agent1, 10e6);

        FlowTypes.Quote memory q1 = _mkQuote(address(trip), 20000, 5e6, keccak256("ord-ag-1"));
        vm.prank(agent1);
        trip.pay(q1, _signQuote(q1));

        FlowTypes.Quote memory q2 = _mkQuote(address(trip), 50000, 15e6, keccak256("ord-ag-2"));
        vm.prank(agent1);
        vm.expectRevert(ITripAccount.AgentCapExceeded.selector);
        trip.pay(q2, _signQuote(q2));
    }

    function test_SetAgentCapAboveOwnerCapReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        vm.prank(tourist1);
        vm.expectRevert(ITripAccount.AgentCapAboveOwnerCap.selector);
        trip.setAgent(agent1, 60e6);
    }

    function test_PayNotAuthorizedReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        FlowTypes.Quote memory q = _mkQuote(address(trip), 10000, 5e6, keccak256("ord-na"));
        vm.prank(address(0xBAD));
        vm.expectRevert(ITripAccount.NotAuthorized.selector);
        trip.pay(q, _signQuote(q));
    }

    // --- P2P happy path ---
    function test_P2PRouteHappyPath() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);

        bytes32 orderId = _createOrder(trip, 10e6, keccak256("p2p-1"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        assertEq(registry.lockedStake(lp1), 10e6);

        vm.prank(lp1); settlement.markPaid(orderId, "pp:ref-123");

        uint256 lpBefore = usdc.balanceOf(lp1);
        uint256 vaultBefore = usdc.balanceOf(address(vault));
        vm.prank(merchant); settlement.confirmReceived(orderId);

        uint256 fee = 10e6 * 50 / 10_000;
        assertEq(uint256(settlement.orderStatus(orderId)), uint256(FlowTypes.OrderStatus.Settled));
        assertEq(usdc.balanceOf(lp1), lpBefore + 10e6 - fee);
        assertEq(usdc.balanceOf(address(vault)), vaultBefore + fee);
        assertEq(registry.lockedStake(lp1), 0);
    }

    function test_ConfirmByConfirmerRoleWorks() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("p2p-conf"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        vm.prank(lp1); settlement.markPaid(orderId, "pp:ref");
        vm.prank(confirmer); settlement.confirmReceived(orderId);
        assertEq(uint256(settlement.orderStatus(orderId)), uint256(FlowTypes.OrderStatus.Settled));
    }

    // --- Routing ---
    function test_RouteToOfframpAfterOpenWindow() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("off-1"));

        vm.prank(orchestrator);
        vm.expectRevert(IFlowSettlement.OpenWindowNotElapsed.selector);
        settlement.routeToOfframp(orderId, offrampId);

        vm.warp(block.timestamp + 11);
        vm.prank(orchestrator);
        settlement.routeToOfframp(orderId, offrampId);
        assertEq(usdc.balanceOf(offrampDest), 10e6);
    }

    function test_RouteToFloatFromOpenAfterWindow() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("float-1"));
        vm.warp(block.timestamp + 11);
        vm.prank(orchestrator); settlement.routeToFloat(orderId);
        assertEq(usdc.balanceOf(address(vault)), 10e6);
    }

    function test_RouteToFloatFromLPAcceptedSlashes() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("slash-1"));
        vm.prank(lp1); settlement.acceptOrder(orderId);

        vm.prank(orchestrator);
        vm.expectRevert(IFlowSettlement.PayWindowNotElapsed.selector);
        settlement.routeToFloat(orderId);

        vm.warp(block.timestamp + 121);
        vm.prank(orchestrator); settlement.routeToFloat(orderId);
        assertEq(registry.totalStake(lp1), 990e6);
        assertEq(usdc.balanceOf(address(vault)), 20e6);
    }

    function test_DisputeSlashesAndRoutesToFloat() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("disp-1"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        vm.prank(lp1); settlement.markPaid(orderId, "fake-ref");
        vm.prank(merchant); settlement.dispute(orderId, "no transfer");
        assertEq(uint256(settlement.orderStatus(orderId)), uint256(FlowTypes.OrderStatus.RoutedFloat));
        assertEq(registry.totalStake(lp1), 990e6);
        assertEq(usdc.balanceOf(address(vault)), 20e6);
    }

    // --- Security invariants ---
    function test_RouteToOfframpOnLPAcceptedReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("sec-off"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        vm.warp(block.timestamp + 20);
        vm.prank(orchestrator);
        vm.expectRevert(IFlowSettlement.OrderNotOpen.selector);
        settlement.routeToOfframp(orderId, offrampId);
    }

    function test_CreateOrderReplayReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        FlowTypes.Quote memory q = _mkQuote(address(trip), 10000, 5e6, keccak256("replay"));
        vm.prank(tourist1); trip.pay(q, _signQuote(q));

        TripAccount trip2 = _mkTrip(address(0xDEAD), 300e6, 50e6);
        usdc.mint(address(trip2), 50e6);
        FlowTypes.Quote memory q2 = _mkQuote(address(trip2), 10000, 5e6, keccak256("replay"));
        vm.prank(address(0xDEAD));
        vm.expectRevert(IFlowSettlement.OrderExists.selector);
        trip2.pay(q2, _signQuote(q2));
    }

    function test_CreateOrderBadSignatureReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        FlowTypes.Quote memory q = _mkQuote(address(trip), 10000, 5e6, keccak256("badsig"));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEADBEEF, keccak256("wrong-digest"));
        bytes memory badSig = abi.encodePacked(r, s, v);
        vm.prank(tourist1);
        vm.expectRevert(IFlowSettlement.QuoteInvalidSigner.selector);
        trip.pay(q, badSig);
    }

    function test_CreateOrderPayerMismatchReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        FlowTypes.Quote memory q = _mkQuote(address(0xFACE), 10000, 5e6, keccak256("pmis"));
        vm.prank(tourist1);
        vm.expectRevert(IFlowSettlement.QuotePayerMismatch.selector);
        trip.pay(q, _signQuote(q));
    }

    function test_MarkPaidByWrongLPReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        _lpStake(lp2, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("mp-wrong"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        vm.prank(lp2);
        vm.expectRevert(IFlowSettlement.NotAssignedLP.selector);
        settlement.markPaid(orderId, "ref");
    }

    function test_AcceptLateWindowReverts() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("late-acc"));
        vm.warp(block.timestamp + 20);
        vm.prank(lp1);
        vm.expectRevert(IFlowSettlement.OpenWindowElapsed.selector);
        settlement.acceptOrder(orderId);
    }

    function test_RefundExpiredPublicSafetyValve() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("rfd-exp"));
        vm.expectRevert(IFlowSettlement.RefundTooEarly.selector);
        settlement.refundExpired(orderId);
        vm.warp(block.timestamp + 3601);
        settlement.refundExpired(orderId);
        assertEq(uint256(settlement.orderStatus(orderId)), uint256(FlowTypes.OrderStatus.Refunded));
    }

    // --- LPRegistry access control ---
    function test_LockStakeOnlySettlement() public {
        _lpStake(lp1, 1000e6);
        vm.prank(address(0xBAD));
        vm.expectRevert(ILPRegistry.NotSettlement.selector);
        registry.lockStake(lp1, 10e6, keccak256("x"));
    }

    function test_UnstakeOnlyFreeStake() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);
        bytes32 orderId = _createOrder(trip, 10e6, keccak256("stake-lock"));
        vm.prank(lp1); settlement.acceptOrder(orderId);
        vm.prank(lp1);
        vm.expectRevert(ILPRegistry.InsufficientFreeStake.selector);
        registry.unstake(995e6);
        vm.prank(lp1); registry.unstake(990e6);
    }

    // --- TreasuryVault ---
    function test_VaultWithdrawByAdmin() public {
        usdc.mint(address(vault), 100e6);
        vm.prank(admin);
        vault.withdraw(admin, 60e6);
        assertEq(vault.balance(), 40e6);
    }

    function test_VaultWithdrawByNonAdminReverts() public {
        usdc.mint(address(vault), 100e6);
        vm.prank(address(0xBAD));
        vm.expectRevert();
        vault.withdraw(address(0xBAD), 10e6);
    }

    // --- gasless ---
    function test_PayWithSigGasless() public {
        TripAccount trip = _mkTrip(tourist1, 300e6, 50e6);
        usdc.mint(address(trip), 50e6);
        _lpStake(lp1, 1000e6);

        FlowTypes.Quote memory q = _mkQuote(address(trip), 10000, 5e6, keccak256("gasless-1"));
        bytes memory quoteSig = _signQuote(q);

        bytes32 QUOTE_TYPEHASH = keccak256(
            "Quote(bytes32 orderRef,bytes32 merchantId,address payer,uint256 fiatAmount,bytes3 currency,uint256 usdcAmount,uint64 expiresAt)"
        );
        bytes32 quoteHash = keccak256(abi.encode(
            QUOTE_TYPEHASH, q.orderRef, q.merchantId, q.payer, q.fiatAmount, q.currency, q.usdcAmount, q.expiresAt
        ));
        bytes32 PAY_TYPEHASH = keccak256("Pay(bytes32 quoteHash,uint256 nonce,uint256 deadline)");
        uint256 deadline = block.timestamp + 60;
        bytes32 structHash = keccak256(abi.encode(PAY_TYPEHASH, quoteHash, uint256(0), deadline));
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("FlowPay-TripAccount"), keccak256("1"), block.chainid, address(trip)
        ));
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(tourist1Pk, digest);
        bytes memory ownerSig = abi.encodePacked(r, s, v);

        vm.prank(address(0xBEEF));
        trip.payWithSig(q, quoteSig, deadline, ownerSig);
        assertEq(trip.spent(), 5e6);
        assertEq(trip.nonce(), 1);
    }
}
