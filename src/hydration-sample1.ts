import { Binary, createClient, Enum, Transaction } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { assetHub, hydration } from "@polkadot-api/descriptors";
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

// https://polkadot.subscan.io/xcm_message/polkadot-c751c3ebfde143246f10a84cb0892f7dbdabd0c3
// POLKADOT_BLOCK_NUMBER=26875160
// POLKADOT_ASSET_HUB_BLOCK_NUMBER=9274851
// HYDRATION_BLOCK_NUMBER=8336277
async function main() {
    const assetHubClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"))
    );
    const assetHubApi = assetHubClient.getTypedApi(assetHub);

    const hydrationClient = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8001"))
    );
    const hydrationApi = hydrationClient.getTypedApi(hydration);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const alicePublicKey = alice.publicKey;
    const aliceSigner = getPolkadotSigner(alicePublicKey, "Sr25519", alice.sign);
    const aliceAddress = ss58Address(alicePublicKey);

    const origin = Enum("system", Enum("Signed", aliceAddress));
    const callData = Binary.fromHex(
        "0x1f0804010100c91f0400010100904e6c1bea56405e8ad6ba79eb5f39b0114635c46a22e93c64115dfc0252e12a040401000003009435770000000000"
    );
    const tx: Transaction<any, string, string, any> = await assetHubApi.txFromCallData(callData);
    const decodedCall: any = tx.decodedCall;
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

        const hydrationBlockBefore = await hydrationClient.getFinalizedBlock()

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
            console.log(`📣 Last message sent on Polkadot Asset Hub: ${sentMessageId}`);

            let processedMessageId = undefined
            const maxRetries = 8;
            for (let i = 0; i < maxRetries; i++) {
                const hydrationBlockAfter = await hydrationClient.getFinalizedBlock()
                if (hydrationBlockAfter.number == hydrationBlockBefore.number) {
                    const waiting = 1_000 * (i + 1);
                    console.log(`⏳ Waiting ${waiting}ms for Hydration block to be finalised (${i + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waiting));
                    continue;
                }

                console.log(`📦 Finalised on Hydration in block #${hydrationBlockAfter.number}: ${hydrationBlockAfter.hash}`);
                const processedEvents = await hydrationApi.event.MessageQueue.Processed.pull();
                if (processedEvents.length > 0) {
                    processedMessageId = processedEvents[0].payload.id.asHex();
                    console.log(`📣 Last message processed on Hydration: ${processedMessageId}`);
                } else {
                    console.log("📣 No Processed events on Hydration found.");
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
    hydrationClient.destroy();
}

main().catch(console.error);