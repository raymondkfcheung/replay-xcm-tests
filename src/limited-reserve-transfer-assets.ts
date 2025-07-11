import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    acala,
    assetHub,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5Junction,
    XcmV5Junctions,
    XcmVersionedAssets,
    XcmVersionedLocation,
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

async function main() {
    const acalaClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8001")),
    );
    const assetHubClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000")),
    );

    const acalaApi = acalaClient.getTypedApi(acala);
    const assetHubApi = assetHubClient.getTypedApi(assetHub);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const userPublicKey = alice.publicKey;
    const aliceSigner = getPolkadotSigner(userPublicKey, "Sr25519", alice.sign);
    const userAddress = ss58Address(userPublicKey);
    const idBeneficiary = Binary.fromHex("0xfc39fcf04a8071b7409823b7c82427ce67910c6ed80aa0e5093aff234624c820");

    const origin = Enum("system", Enum("Signed", userAddress));

    const tx: any = assetHubApi.tx.PolkadotXcm.limited_reserve_transfer_assets({
        dest: XcmVersionedLocation.V5({
            parents: 1,
            interior: XcmV5Junctions.X1(
                XcmV5Junction.Parachain(2000),
            ),
        }),
        beneficiary: XcmVersionedLocation.V5({
            parents: 0,
            interior: XcmV5Junctions.X1(
                XcmV5Junction.AccountId32({
                    network: undefined,
                    id: idBeneficiary,
                }),
            ),
        }),
        assets: XcmVersionedAssets.V5([
            {
                id: {
                    parents: 0,
                    interior: XcmV5Junctions.X2([
                        XcmV5Junction.PalletInstance(50),
                        XcmV5Junction.GeneralIndex(1984n),
                    ]
                    ),
                },
                fun: XcmV3MultiassetFungibility.Fungible(508000804n),
            },
        ]),
        fee_asset_item: 0,
        weight_limit: XcmV3WeightLimit.Unlimited(),
    });
    const decodedCall = tx.decodedCall;
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

        const acalaBlockBefore = await acalaClient.getFinalizedBlock()

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
            const maxRetries = 3;
            for (let i = 0; i < maxRetries; i++) {
                const acalaBlockAfter = await acalaClient.getFinalizedBlock()
                if (acalaBlockAfter.number == acalaBlockBefore.number) {
                    const waiting = 1_000 * (i + 1);
                    console.log(`⏳ Waiting ${waiting}ms for Acala block to be finalised (${i + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waiting));
                    continue;
                }

                console.log(`📦 Finalised on Acala in block #${acalaBlockAfter.number}: ${acalaBlockAfter.hash}`);
                const processedEvents = await acalaApi.event.MessageQueue.Processed.pull();
                if (processedEvents.length > 0) {
                    processedMessageId = processedEvents[0].payload.id.asHex();
                    console.log(`📣 Last message Processed on Acala: ${processedMessageId}`);
                } else {
                    console.log("📣 No Processed events on Acala found.");
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

    acalaClient.destroy();
    assetHubClient.destroy();
}

main().catch(console.error);