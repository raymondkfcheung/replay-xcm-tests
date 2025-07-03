import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import {
    XcmVersionedXcm,
    assetHubWestend,
    XcmVersionedLocation,
    XcmV3Junction,
    XcmV3Junctions,
    XcmV3WeightLimit,
    XcmV3MultiassetFungibility,
    XcmV3MultiassetAssetId,
    XcmV3Instruction,
    XcmV3MultiassetMultiAssetFilter,
    XcmV3MultiassetWildMultiAsset,
} from '@polkadot-api/descriptors';
import { Binary } from 'polkadot-api';
import { Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
    await cryptoWaitReady();

    // Connect to Westend Asset Hub
    const client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:8000")),
    );

    const assetHubWestendApi = client.getTypedApi(assetHubWestend);

    const keyring = new Keyring({ type: "sr25519" });
    const alice = keyring.addFromUri("//Alice");
    const idBeneficiary = Binary.fromBytes(alice.publicKey);

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
    const dryRunResult = await assetHubWestendApi.apis.DryRunApi.dry_run_xcm(
        origin,
        xcm,
    );

    // Print the results
    console.dir(dryRunResult.value, { depth: null });

    client.destroy();
}

main().catch(console.error);