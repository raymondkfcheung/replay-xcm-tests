import { Binary, createClient, Enum, Transaction } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHub,
    hydration,
    DotXcmVersionedAssetId,
    DotXcmVersionedAssets,
    DotXcmVersionedLocation,
    DotXcmVersionedXcm,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5Instruction,
    XcmV5Junction,
    XcmV5Junctions,
    XcmV5WildAsset,
    XcmV5AssetFilter,
} from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Address } from "@polkadot-labs/hdkd-helpers";

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

// https://polkadot.subscan.io/xcm_message/polkadot-21cb2a17fca9e66133c46d2adedbaac07bdf1a08
// POLKADOT_BLOCK_NUMBER=26875418
// POLKADOT_ASSET_HUB_BLOCK_NUMBER=9274976
// HYDRATION_BLOCK_NUMBER=8336534
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
    const aliceSigner = getPolkadotSigner(alicePublicKey, "Sr25519", alice.sign);
    const aliceAddress = ss58Address(alicePublicKey);

    const origin = Enum("system", Enum("Signed", aliceAddress));
    const reserve = Enum("LocalReserve");
    const assetId = {
        parents: 1,
        interior: XcmV5Junctions.Here(),
    };
    const tx: Transaction<any, string, string, any> = assetHubApi.tx.PolkadotXcm.transfer_assets_using_type_and_then({
        dest: DotXcmVersionedLocation.V4({
            parents: 1,
            interior: XcmV5Junctions.X1(
                XcmV5Junction.Parachain(2034)
            )
        }),
        assets: DotXcmVersionedAssets.V4([
            {
                id: assetId,
                fun: XcmV3MultiassetFungibility.Fungible(3_823_214_300_643n),
            }
        ]),
        assets_transfer_type: reserve,
        remote_fees_id: DotXcmVersionedAssetId.V4(assetId),
        fees_transfer_type: reserve,
        custom_xcm_on_dest: DotXcmVersionedXcm.V4([
            XcmV5Instruction.DepositAsset({
                assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
                beneficiary: {
                    parents: 0,
                    interior: XcmV5Junctions.X1(
                        XcmV5Junction.AccountId32({ id: Binary.fromHex("0xa2c0ccb3b953bb79a4109ce8f56d1538bc5ac2d8f428f4531df973bb7e3c7c13") })
                    )
                }
            })
        ]),
        weight_limit: XcmV3WeightLimit.Unlimited(),
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
                    console.log("📣 No Processed events on ${parachainName} found.");
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