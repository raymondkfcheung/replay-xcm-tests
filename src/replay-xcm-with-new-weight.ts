import { Binary, createClient, Transaction } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { assetHub, XcmVersionedXcm } from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";

const toHuman = (_key: any, value: any) => {
    if (typeof value === "bigint") {
        return Number(value);
    }

    if (value && typeof value === "object" && typeof value.asHex === "function") {
        return value.asHex();
    }

    return value;
};

function getSigner() {
    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");

    return getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);
}

async function main() {
    const provider = withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"));
    const client = createClient(provider);
    const api = client.getTypedApi(assetHub);
    const aliceSigner = getSigner();

    const callData = Binary.fromHex(
        "0x1f03040c00040002043205011f00828d5b002b010e01010002043205011f00010100c91f0c13010300a10f043205011f00828d5b00000f0101010300a10f043205011f000401000003bce2c5d300100101010000010100a10f081301000003bae2c5d3000d010101000000010100769cac6c783b28e8ecf3c404af388996435b1f8aba90b0f363928caaf342142f2254c7aff598"
    );
    const histTx: Transaction<any, string, string, any> = await api.txFromCallData(callData);
    const message: XcmVersionedXcm = histTx.decodedCall.value.value.message;
    const weight: any = await api.apis.XcmPaymentApi.query_xcm_weight(message);
    if (weight.success !== true) {
        console.error("❌ Failed to query XCM weight:", weight.error);
        client.destroy();
        return;
    }

    const tx: Transaction<any, string, string, any> = api.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    const decodedCall: any = tx.decodedCall;
    console.log("👀 Executing XCM:", JSON.stringify(decodedCall, toHuman, 2));

    await new Promise<void>((resolve) => {
        const subscription = tx.signSubmitAndWatch(aliceSigner).subscribe((ev) => {
            if (ev.type === "finalized" || (ev.type === "txBestBlocksState" && ev.found)) {
                console.log(`📦 Included in block #${ev.block.number}: ${ev.block.hash}`);

                if (!ev.ok) {
                    const dispatchError = ev.dispatchError;
                    if (dispatchError.type === "Module") {
                        const modErr: any = dispatchError.value;
                        console.error(`❌ Dispatch error in module: ${modErr.type} → ${modErr.value?.type}`);
                    } else {
                        console.error("❌ Dispatch error:", JSON.stringify(dispatchError, toHuman, 2));
                    }
                }

                for (const event of ev.events) {
                    console.log("📣 Event:", event.type, JSON.stringify(event.value, toHuman, 2));
                }

                console.log("✅ Process completed, exiting...");
                subscription.unsubscribe();
                resolve();
            }
        });
    });

    client.destroy();
}

main().catch(console.error);