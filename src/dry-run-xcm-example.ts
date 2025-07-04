import { Binary, createClient } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHub,
    XcmV3Instruction,
    XcmV3Junction,
    XcmV3Junctions,
    XcmV3MultiassetAssetId,
    XcmV3MultiassetFungibility,
    XcmV3MultiassetMultiAssetFilter,
    XcmV3MultiassetWildMultiAsset,
    XcmV3WeightLimit,
    XcmVersionedLocation,
    XcmVersionedXcm,
} from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";

// https://docs.polkadot.com/develop/interoperability/xcm-runtime-apis/#dry-run-xcm
async function main() {
    // Connect to Asset Hub
    const client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000")),
    );
    const assetHubApi = client.getTypedApi(assetHub);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const userPublicKey = alice.publicKey;
    const idBeneficiary = Binary.fromBytes(userPublicKey);

    // Define the origin
    const origin = XcmVersionedLocation.V3({
        parents: 1,
        interior: XcmV3Junctions.Here(),
    });

    // Define a xcm message comming from the Paseo relay chain to Asset Hub to Teleport some tokens
    const xcm = XcmVersionedXcm.V3([
        XcmV3Instruction.ReceiveTeleportedAsset([
            {
                id: XcmV3MultiassetAssetId.Concrete({
                    parents: 1,
                    interior: XcmV3Junctions.Here(),
                }),
                fun: XcmV3MultiassetFungibility.Fungible(12000000000n),
            },
        ]),
        XcmV3Instruction.ClearOrigin(),
        XcmV3Instruction.BuyExecution({
            fees: {
                id: XcmV3MultiassetAssetId.Concrete({
                    parents: 1,
                    interior: XcmV3Junctions.Here(),
                }),
                fun: XcmV3MultiassetFungibility.Fungible(BigInt(12000000000n)),
            },
            weight_limit: XcmV3WeightLimit.Unlimited(),
        }),
        XcmV3Instruction.DepositAsset({
            assets: XcmV3MultiassetMultiAssetFilter.Wild(
                XcmV3MultiassetWildMultiAsset.All(),
            ),
            beneficiary: {
                parents: 0,
                interior: XcmV3Junctions.X1(
                    XcmV3Junction.AccountId32({
                        network: undefined,
                        id: idBeneficiary,
                    }),
                ),
            },
        }),
    ]);

    // Execute dry run xcm
    const dryRunResult = await assetHubApi.apis.DryRunApi.dry_run_xcm(
        origin,
        xcm,
    );

    // Print the results
    console.dir(dryRunResult.value, { depth: null });

    client.destroy();
}

main().catch(console.error);