import { assetHub, AssetHubCalls, XcmV5Instruction, XcmV5Junction, XcmV5Junctions } from "@polkadot-api/descriptors";
import { Binary, createClient, Enum } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner } from "polkadot-api/signer";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Keyring } from "@polkadot/keyring";
import { blake2AsHex, cryptoWaitReady } from '@polkadot/util-crypto';

const toHuman = (_key: any, value: any) => {
    if (typeof value === 'bigint') {
        return Number(value);
    }

    if (value && typeof value === "object" && typeof value.asHex === "function") {
        return value.asHex();
    }

    return value;
};

async function main() {
    await cryptoWaitReady();
    const provider = withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"));
    const client = createClient(provider);
    const api = client.getTypedApi(assetHub);

    const keyring = new Keyring({ type: "sr25519" });
    const alice = keyring.addFromUri("//Alice");
    const aliceSigner = getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);

    const message: AssetHubCalls['PolkadotXcm']['execute']['message'] = Enum("V5", [
        XcmV5Instruction.DescendOrigin(
            XcmV5Junctions.X1(XcmV5Junction.AccountId32({ network: undefined, id: Binary.fromBytes(alice.publicKey) }))
        ),
        XcmV5Instruction.SetTopic(Binary.fromHex(blake2AsHex("replay-xcm-tests-topic", 256))),
    ]);
    console.log("XCM:", JSON.stringify(message, toHuman, 2));

    const weight: any = await api.apis.XcmPaymentApi.query_xcm_weight(message);
    console.log("Estimated weight:", weight);

    const tx = api.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    console.log("Decoded Call:", JSON.stringify(tx.decodedCall, toHuman, 2));

    const result = await tx.signAndSubmit(aliceSigner);
    console.log(`✅ Finalised in block #${result.block.number}: ${result.block.hash}`);
    if (!result.ok) {
        const dispatchError = result.dispatchError;
        if (dispatchError.type === "Module") {
            const modErr: any = dispatchError.value;
            console.error("❌ Dispatch error in module:", modErr.type, modErr.value?.type);
        } else {
            console.error("❌ Dispatch error:", JSON.stringify(dispatchError, toHuman, 2));
        }
    }
    for (const event of result.events) {
        console.log("📣 Event:", event.type, JSON.stringify(event.value, toHuman, 2));
    }

    client.destroy();
}

main().catch(console.error);
