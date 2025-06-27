import { assetHub, XcmVersionedXcm } from "@polkadot-api/descriptors";
import { Binary, createClient, Enum, Transaction } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";

const XCM_VERSION = 5;

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

    const callData = Binary.fromHex(
        "0x1f0803010100411f0300010100fc39fcf04a8071b7409823b7c82427ce67910c6ed80aa0e5093aff234624c8200304000002043205011f0092e81d790000000000"
    );
    const tx: Transaction<any, string, string, any> = await api.txFromCallData(callData);
    const call = tx.decodedCall as any;
    console.log("Executing XCM:", JSON.stringify(call, toHuman, 2));

    const origin = Enum("system", Enum("Signed", alice.address));
    const dryRunResult: any = await api.apis.DryRunApi.dry_run_call(origin, call, XCM_VERSION);
    const {
        execution_result: executionResult,
        emitted_events: emmittedEvents,
        local_xcm: localXcm,
        forwarded_xcms: forwardedXcms,
    } = dryRunResult.value;

    if (!dryRunResult.success || !executionResult.success) {
        console.error("❌ Local dry run failed", JSON.stringify(dryRunResult, toHuman, 2));
    } else {
        console.log("✅ Local dry run successful");
        console.log("📦 Dry run result:", JSON.stringify(dryRunResult.value, toHuman, 2));

        for (const event of emmittedEvents) {
            console.log("📣 Event:", event.type, JSON.stringify(event.value, toHuman, 2));
        }

        const localXcmWeight: any = await api.apis.XcmPaymentApi.query_xcm_weight(localXcm as XcmVersionedXcm);
        if (localXcmWeight.success !== true) {
            console.error("❌ Failed to query Local XCM weight:", localXcmWeight.error);
            client.destroy();
            return;
        } else {
            console.log("Weigth for Local XCM:", JSON.stringify(localXcmWeight, toHuman, 2));
        }

        const remoteXcm: XcmVersionedXcm = forwardedXcms[0][1][0];
        const remoteXcmWeight: any = await api.apis.XcmPaymentApi.query_xcm_weight(remoteXcm);
        if (remoteXcmWeight.success !== true) {
            console.error("❌ Failed to query Remote XCM weight:", remoteXcmWeight.error);
            client.destroy();
            return;
        } else {
            console.log("Weigth for Remote XCM:", JSON.stringify(remoteXcmWeight, toHuman, 2));
        }
    }

    client.destroy();
}

main().catch(console.error);
