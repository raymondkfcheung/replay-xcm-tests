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
    XcmV5Junction,
    XcmV5Junctions,
    XcmV5WildAsset,
    XcmVersionedXcm,
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

// https://polkadot.subscan.io/xcm_message/polkadot-cfb84b3fbd1472b7d68a5b4539d4448c34020e04
async function main() {
    const para1Name = "Polkadot Asset Hub";
    const para1Client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"))
    );
    const para1Api = para1Client.getTypedApi(assetHub);

    const para2Name = "Hydration";
    const para2Client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8001"))
    );
    const para2Api = para2Client.getTypedApi(hydration);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const alicePublicKey = alice.publicKey;
    const aliceSigner = getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);
    const aliceAddress = ss58Address(alicePublicKey);

    const origin = Enum("system", Enum("Signed", aliceAddress));
    const expectedMessageId = "0x836c6039763718fd3db4e22484fc4bacd7ddf1c74b6067d15b297ea72d8ecf89";
    const message = XcmVersionedXcm.V5([
        XcmV5Instruction.WithdrawAsset([{
            id: {
                interior: XcmV5Junctions.Here(),
                parents: 1,
            },
            fun: XcmV3MultiassetFungibility.Fungible(1_000_000_000n),
        }]),
        XcmV5Instruction.ClearOrigin(),
        XcmV5Instruction.BuyExecution({
            fees: {
                id: {
                    interior: XcmV5Junctions.Here(),
                    parents: 1,
                },
                fun: XcmV3MultiassetFungibility.Fungible(500_000_000n),
            },
            weight_limit: XcmV3WeightLimit.Unlimited(),
        }),
        XcmV5Instruction.DepositReserveAsset({
            assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
            dest: {
                interior: XcmV5Junctions.X1(
                    XcmV5Junction.Parachain(2034)
                ),
                parents: 1,
            },
            xcm: [
                XcmV5Instruction.BuyExecution({
                    fees: {
                        id: {
                            interior: XcmV5Junctions.Here(),
                            parents: 1,
                        },
                        fun: XcmV3MultiassetFungibility.Fungible(500_000_000n),
                    },
                    weight_limit: XcmV3WeightLimit.Unlimited(),
                }),
                XcmV5Instruction.DepositAsset({
                    assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
                    beneficiary: {
                        interior: XcmV5Junctions.X1(
                            XcmV5Junction.AccountKey20({
                                key: Binary.fromHex("0x6971655f19dbe2da9112e50ffdde3dfdcbdf5562"),
                            }),
                        ),
                        parents: 0,
                    },
                }),
            ],
        }),
        XcmV5Instruction.SetTopic(Binary.fromHex(expectedMessageId)),
    ]);

    const weight: any = await para1Api.apis.XcmPaymentApi.query_xcm_weight(message);
    if (weight.success !== true) {
        console.error("❌ Failed to query XCM weight:", weight.error);
        para1Client.destroy();
        return;
    }

    const tx: Transaction<any, string, string, any> = para1Api.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    const decodedCall = tx.decodedCall as any;
    console.log("👀 Executing XCM:", JSON.stringify(decodedCall, toHuman, 2));

    const dryRunResult: any = await para1Api.apis.DryRunApi.dry_run_call(
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

        let parachainBlockBefore = await para2Client.getFinalizedBlock()

        const ev = await tx.signAndSubmit(aliceSigner);
        console.log(`📦 Finalised on ${para1Name} in block #${ev.block.number}: ${ev.block.hash}`);

        if (!ev.ok) {
            const dispatchError = ev.dispatchError;
            if (dispatchError.type === "Module") {
                const modErr: any = dispatchError.value;
                console.error(`❌ Dispatch error in module: ${modErr.type} → ${modErr.value?.type}`);
            } else {
                console.error("❌ Dispatch error:", JSON.stringify(dispatchError, toHuman, 2));
            }
        }

        const sentEvents = await para1Api.event.PolkadotXcm.Sent.pull();
        if (sentEvents.length > 0) {
            const sentMessageId = sentEvents[0].payload.message_id.asHex();
            console.log(`📣 Last message Sent on ${para1Name}: ${sentMessageId}`);
            if (sentMessageId === expectedMessageId) {
                console.log("✅ Sent message ID matched.");
            } else {
                console.error("❌ Sent message ID does not match expexted message ID.");
            }

            let processedMessageId = undefined
            const maxRetries = 8;
            for (let i = 0; i < maxRetries; i++) {
                const parachainBlockAfter = await para2Client.getFinalizedBlock()
                if (parachainBlockAfter.number == parachainBlockBefore.number) {
                    const waiting = 1_000 * (i + 1);
                    console.log(`⏳ Waiting ${waiting}ms for ${para2Name} block to be finalised (${i + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waiting));
                    continue;
                }

                console.log(`📦 Finalised on ${para2Name} in block #${parachainBlockAfter.number}: ${parachainBlockAfter.hash}`);
                const processedEvents = await para2Api.event.MessageQueue.Processed.pull();
                const processingFailedEvents = await para2Api.event.MessageQueue.ProcessingFailed.pull();
                if (processedEvents.length > 0) {
                    processedMessageId = processedEvents[0].payload.id.asHex();
                    console.log(`📣 Last message Processed on ${para2Name}: ${processedMessageId}`);
                    break;
                } else if (processingFailedEvents.length > 0) {
                    processedMessageId = processingFailedEvents[0].payload.id.asHex();
                    console.log(`📣 Last message ProcessingFailed on ${para2Name}: ${processedMessageId}`);
                    break;
                } else {
                    console.log(`📣 No Processed events on ${para2Name} found.`);
                    parachainBlockBefore = parachainBlockAfter; // Update the block before to the latest one
                }
            }

            if (processedMessageId === expectedMessageId) {
                console.log("✅ Processed Message ID matched.");
            } else {
                console.error("❌ Processed message ID does not match expected message ID.");
            }
        } else {
            console.log(`📣 No Sent events on ${para1Name} found.`);
        }
    }

    para1Client.destroy();
    para2Client.destroy();
}

main().catch(console.error);