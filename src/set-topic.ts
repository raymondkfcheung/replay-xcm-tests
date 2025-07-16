import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHub,
    XcmV5Instruction,
    XcmV5Junction,
    XcmV5Junctions,
    XcmVersionedXcm,
} from "@polkadot-api/descriptors";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

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
    const provider = withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"));
    const client = createClient(provider);
    const api = client.getTypedApi(assetHub);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const aliceSigner = getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);

    const message = XcmVersionedXcm.V5([
        XcmV5Instruction.DescendOrigin(
            XcmV5Junctions.X1(XcmV5Junction.AccountId32({ id: Binary.fromBytes(alice.publicKey) }))
        ),
        XcmV5Instruction.SetTopic(Binary.fromHex("0xd60225f721599cb7c6e23cdf4fab26f205e30cd7eb6b5ccf6637cdc80b2339b2")),
    ]);
    const weight: any = await api.apis.XcmPaymentApi.query_xcm_weight(message);
    if (weight.success !== true) {
        console.error("❌ Failed to query XCM weight:", weight.error);
        client.destroy();
        return;
    }
    const tx = api.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    console.log("👀 Executing XCM:", JSON.stringify(tx.decodedCall, toHuman, 2));

    const ev = await tx.signAndSubmit(aliceSigner);
    console.log(`📦 Finalised in block #${ev.block.number}: ${ev.block.hash}`);

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

    client.destroy();
}

main().catch(console.error);
