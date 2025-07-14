import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHubWestend,
    bridgeHubWestend,
    DotXcmVersionedAssetId,
    DotXcmVersionedAssets,
    DotXcmVersionedLocation,
    DotXcmVersionedXcm,
    XcmV3JunctionNetworkId,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5Instruction,
    XcmV5Junction,
    XcmV5Junctions,
    XcmV5NetworkId,
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

    const assetHubApi = assetHubClient.getTypedApi(assetHubWestend);
    const bridgeHubApi = acalaClient.getTypedApi(bridgeHubWestend);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const userPublicKey = alice.publicKey;
    const aliceSigner = getPolkadotSigner(userPublicKey, "Sr25519", alice.sign);
    const userAddress = ss58Address(userPublicKey);

    const origin = Enum("system", Enum("Signed", userAddress))

    const dest = DotXcmVersionedLocation.V4({
        parents: 1,
        interior: XcmV5Junctions.X1(
            XcmV5Junction.Parachain(2313)
        )
    });

    const assetHubLocation = Enum("RemoteReserve", DotXcmVersionedLocation.V4({
        parents: 1,
        interior: XcmV5Junctions.X1(
            XcmV5Junction.Parachain(1000)
        )
    }));

    const assetId = {
        parents: 1,
        interior: XcmV5Junctions.X2([
            XcmV5Junction.GlobalConsensus(XcmV5NetworkId.ByGenesis(Binary.fromHex("0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e"))),
            XcmV5Junction.Parachain(2313),
        ]),
    };

    const customXcmOnDest = DotXcmVersionedXcm.V4([
        XcmV5Instruction.DepositAsset({
            assets: {
                type: "Wild",
                value: { type: "AllCounted", value: 1 }
            },
            beneficiary: {
                parents: 1,
                interior: XcmV5Junctions.X1(
                    XcmV5Junction.Parachain(1000)
                )
            }
        })
    ]);

    const tx: any = assetHubApi.tx.PolkadotXcm.transfer_assets_using_type_and_then({
        dest,
        assets: DotXcmVersionedAssets.V4([
            {
                id: assetId,
                fun: XcmV3MultiassetFungibility.Fungible(100_000_000n),
            }
        ]),
        assets_transfer_type: assetHubLocation,
        remote_fees_id: DotXcmVersionedAssetId.V4(assetId),
        fees_transfer_type: assetHubLocation,
        custom_xcm_on_dest: customXcmOnDest,
        weight_limit: XcmV3WeightLimit.Unlimited(),
    });
    const decodedCall = tx.decodedCall;
    console.log("👀 Executing XCM:", JSON.stringify(decodedCall, toHuman, 2));

    const dryRunResult: any = await bridgeHubApi.apis.DryRunApi.dry_run_call(
        origin,
        decodedCall,
        XCM_VERSION,
    );
    console.log("📦 Dry run result:", JSON.stringify(dryRunResult.value, toHuman, 2));

    acalaClient.destroy();
    assetHubClient.destroy();
}

main().catch(console.error);