import { Binary, createClient, Enum, Transaction } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHub,
    hydration,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5AssetFilter,
    XcmV5Instruction,
    XcmV5Junctions,
    XcmV5WildAsset,
    XcmV5Junction,
    XcmVersionedXcm,
} from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Address } from "@polkadot-labs/hdkd-helpers";

const UNIT = 1_000_000_000_000n;
const XCM_VERSION = 5;

const toHuman = (_key: any, value: any) => {
    if (typeof value === "bigint") {
        return Number(value);
    }

    if (value && typeof value === "object" && typeof value.asHex === "function") {
        return value.asHex();
    }

    return value;
};

async function main() {
    const assetHubClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"))
    );
    const assetHubApi = assetHubClient.getTypedApi(assetHub);

    const parachainName = "Hydration";
    const parachainClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8001"))
    );
    const parachainApi = parachainClient.getTypedApi(hydration);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const alicePublicKey = alice.publicKey;
    const aliceSigner = getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);
    const aliceAddress = ss58Address(alicePublicKey);

    const origin = Enum("system", Enum("Signed", aliceAddress));

    const allAssets = XcmV5AssetFilter.Wild(XcmV5WildAsset.All());

    const assetHubDest = {
        interior: XcmV5Junctions.Here(),
        parents: 1,
    };

    const dotAssetId = {
        interior: XcmV5Junctions.Here(),
        parents: 1,
    };

    const dotAsset = {
        id: dotAssetId,
        fun: XcmV3MultiassetFungibility.Fungible(UNIT),
    };

    const dotAssetSwapFilter = XcmV5AssetFilter.Definite([dotAsset]);

    const dotFeeAsset = {
        id: dotAssetId,
        fun: XcmV3MultiassetFungibility.Fungible(UNIT),
    };

    const hydradxDest = {
        interior: XcmV5Junctions.X1(
            XcmV5Junction.Parachain(2034)
        ),
        parents: 1,
    };

    const usdtAsset = {
        id: {
            parents: 0,
            interior: XcmV5Junctions.X2([
                XcmV5Junction.PalletInstance(50),
                XcmV5Junction.GeneralIndex(1984n),
            ]),
        },
        fun: XcmV3MultiassetFungibility.Fungible(500_000_000n),
    };

    const message = XcmVersionedXcm.V5([
        // 1. Withdraw DOT from Asset Hub
        XcmV5Instruction.WithdrawAsset([dotAsset]),

        // 2. Deposit to HydraDX with instructions
        XcmV5Instruction.DepositReserveAsset({
            assets: allAssets,
            dest: hydradxDest,
            xcm: [
                // 2a. Pay for execution on HydraDX
                XcmV5Instruction.BuyExecution({
                    fees: dotFeeAsset,
                    weight_limit: XcmV3WeightLimit.Unlimited(),
                }),

                // 2b. Exchange DOT for USDT
                XcmV5Instruction.ExchangeAsset({
                    give: dotAssetSwapFilter,
                    want: [usdtAsset],
                    maximal: true,
                }),

                // 2c. Send swapped USDT back to Asset Hub
                XcmV5Instruction.InitiateReserveWithdraw({
                    assets: allAssets,
                    reserve: assetHubDest,
                    xcm: [
                        XcmV5Instruction.BuyExecution({
                            fees: dotFeeAsset,
                            weight_limit: XcmV3WeightLimit.Unlimited(),
                        }),
                        XcmV5Instruction.DepositAsset({
                            assets: allAssets,
                            beneficiary: {
                                interior: XcmV5Junctions.X1(
                                    XcmV5Junction.AccountKey20({
                                        key: Binary.fromHex("0x302f0b71b8ad3cf6dd90adb668e49b2168d652fd"),
                                    }),
                                ),
                                parents: 0,
                            },
                        }),
                    ],
                }),
            ],
        }),
    ]);

    const weight: any = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(message);
    if (weight.success !== true) {
        console.error("❌ Failed to query XCM weight:", weight.error);
        assetHubClient.destroy();
        return;
    }

    const tx: Transaction<any, string, string, any> = assetHubApi.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    const decodedCall = tx.decodedCall as any;
    console.log("👀 Executing XCM:", JSON.stringify(decodedCall, toHuman, 2));

    const dryRunResult: any = await assetHubApi.apis.DryRunApi.dry_run_call(
        origin,
        decodedCall,
        XCM_VERSION,
    );
    console.log("📦 Dry run result:", JSON.stringify(dryRunResult.value, toHuman, 2));

    const {
        execution_result: executionResult,
        emitted_events: _emmittedEvents,
        local_xcm: _localXcm,
        forwarded_xcms: _forwardedXcms,
    } = dryRunResult.value;

    if (!dryRunResult.success || !executionResult.success) {
        console.error("❌ Local dry run failed!");
    } else {
        console.log("✅ Local dry run successful.");

        const parachainBlockBefore = await parachainClient.getFinalizedBlock()

        const ev = await tx.signAndSubmit(aliceSigner);
        console.log(`📦 Finalised on Polkadot Asset Hub in block #${ev.block.number}: ${ev.block.hash}`);

        if (!ev.ok) {
            const dispatchError = ev.dispatchError;
            if (dispatchError.type === "Module") {
                const modErr: any = dispatchError.value;
                console.error(`❌ Dispatch error in module: ${modErr.type} → ${modErr.value?.type}`);
            } else {
                console.error("❌ Dispatch error:", JSON.stringify(dispatchError, toHuman, 2));
            }
        }

        const sentEvents = await assetHubApi.event.PolkadotXcm.Sent.pull();
        if (sentEvents.length > 0) {
            const sentMessageId = sentEvents[0].payload.message_id.asHex();
            console.log(`📣 Last message Sent on Polkadot Asset Hub: ${sentMessageId}`);

            let processedMessageId = undefined
            const maxRetries = 8;
            for (let i = 0; i < maxRetries; i++) {
                const parachainBlockAfter = await parachainClient.getFinalizedBlock()
                if (parachainBlockAfter.number == parachainBlockBefore.number) {
                    const waiting = 1_000 * (i + 1);
                    console.log(`⏳ Waiting ${waiting}ms for ${parachainName} block to be finalised (${i + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waiting));
                    continue;
                }

                console.log(`📦 Finalised on ${parachainName} in block #${parachainBlockAfter.number}: ${parachainBlockAfter.hash}`);
                const processedEvents = await parachainApi.event.MessageQueue.Processed.pull();
                if (processedEvents.length > 0) {
                    processedMessageId = processedEvents[0].payload.id.asHex();
                    console.log(`📣 Last message Processed on ${parachainName}: ${processedMessageId}`);
                } else {
                    console.log(`📣 No Processed events on ${parachainName} found.`);
                }

                break;
            }

            if (processedMessageId === sentMessageId) {
                console.log("✅ Message ID matched.");
            } else {
                console.error("❌ Processed message ID does not match sent message ID.");
            }
        } else {
            console.log("📣 No Sent events on Polkadot Asset Hub found.");
        }
    }

    assetHubClient.destroy();
    parachainClient.destroy();
}

main().catch(console.error);