import { assetHub } from "@polkadot-api/descriptors";
import { Binary, createClient, Enum } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner } from "polkadot-api/signer";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";

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

    const callData = Binary.fromHex(
        "0x1f0803010100411f0300010100fc39fcf04a8071b7409823b7c82427ce67910c6ed80aa0e5093aff234624c8200304000002043205011f0092e81d790000000000"
    );
    const tx: any = await api.txFromCallData(callData);
    console.log("Executing XCM:", JSON.stringify(tx.decodedCall, toHuman, 2));

    const origin = Enum("system", Enum("Signed", alice.address));
    const localDryRun = await api.apis.DryRunApi.dry_run_call(origin, tx.decodedCall, 5);

    if (!localDryRun.success || !localDryRun.value.execution_result.success) {
        console.error("❌ Local dry run failed", JSON.stringify(localDryRun, toHuman, 2));
    } else {
        console.log("✅ Local dry run successful");
        console.log("📦 Dry run result:", JSON.stringify(localDryRun.value, toHuman, 2));
    }

    client.destroy();
}

main().catch(console.error);
