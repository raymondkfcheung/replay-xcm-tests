import { assetHub } from "@polkadot-api/descriptors";
import { Binary, createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner } from "polkadot-api/signer";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from '@polkadot/util-crypto';

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

    const clientAHP = createClient(withPolkadotSdkCompat(getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io")));
    const hash = await clientAHP._request<string>("chain_getBlockHash", [9079592]);
    const block = await clientAHP._request<any>("chain_getBlock", [hash]);
    const extrinsics = block.block.extrinsics;
    // extrinsics.forEach((ext: string, index: number) => {
    //     console.log(`Extrinsic ${index}:`, ext);
    // });
    const extrinsic = extrinsics[2];
    const callData = Binary.fromHex(extrinsic);
    console.log("Hex call data:", callData.asHex());

    const tx = await api.txFromCallData(callData);
    console.log("Executing XCM:", JSON.stringify(tx.decodedCall, toHuman, 2));

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
