import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { assetHubWestend } from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Address } from "@polkadot-labs/hdkd-helpers";

const XCM_VERSION = 5;

async function main() {
    const provider = withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"));
    const client = createClient(provider);
    const api = client.getTypedApi(assetHubWestend);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const aliceAddress = ss58Address(alice.publicKey);

    const callData = Binary.fromHex(
        "0x051800040100000baaaf24222b03130100000baaaf24222b030002040101002524000284d7170a0e0101010100252400020109079edaa8020c1301020900e143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e0025240004000d01020400010300302f0b71b8ad3cf6dd90adb668e49b2168d652fd2c5c082b4750ee8c34986eb22ce6e345bad2360f3682cda3e99de94b0d9970cb3e2c5c082b4750ee8c34986eb22ce6e345bad2360f3682cda3e99de94b0d9970cb3e"
    );
    const tx: any = await api.txFromCallData(callData);
    const origin = Enum("system", Enum("Signed", aliceAddress));
    const dryRunResult: any = await api.apis.DryRunApi.dry_run_call(origin, tx.decodedCall, XCM_VERSION);
    console.dir(dryRunResult.value, { depth: null });

    client.destroy();
}

main().catch(console.error);