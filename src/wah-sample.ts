import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHubWestend,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5AssetFilter,
    XcmV5Instruction,
    XcmV5Junction,
    XcmV5Junctions,
    XcmV5NetworkId,
    XcmV5WildAsset,
    XcmVersionedXcm,
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
    const provider = withPolkadotSdkCompat(getWsProvider("ws://localhost:8000"));
    const client = createClient(provider);
    const api = client.getTypedApi(assetHubWestend);

    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");
    const aliceAddress = ss58Address(alice.publicKey);

    const asset = {
        id: {
            interior: XcmV5Junctions.Here(),
            parents: 1,
        },
        fun: XcmV3MultiassetFungibility.Fungible(3_408_244_766_666n),
    };
    const network = XcmV5NetworkId.ByGenesis(Binary.fromHex("0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e"));
    const setTopic = XcmV5Instruction.SetTopic(Binary.fromHex("0x5c082b4750ee8c34986eb22ce6e345bad2360f3682cda3e99de94b0d9970cb3e"))
    const message = XcmVersionedXcm.V5([
        XcmV5Instruction.WithdrawAsset([asset]),
        XcmV5Instruction.BuyExecution({
            fees: asset,
            weight_limit: XcmV3WeightLimit.Unlimited(),
        }),
        XcmV5Instruction.SetAppendix([
            XcmV5Instruction.DepositAsset({
                assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
                beneficiary: {
                    interior: XcmV5Junctions.X1(
                        XcmV5Junction.Parachain(1000)
                    ),
                    parents: 1,
                }
            })
        ]),
        XcmV5Instruction.ExportMessage({
            network,
            destination: XcmV5Junctions.Here(),
            xcm: [
                XcmV5Instruction.ReserveAssetDeposited([{
                    id: {
                        interior: XcmV5Junctions.X2([
                            XcmV5Junction.GlobalConsensus(network),
                            XcmV5Junction.Parachain(2313),
                        ]),
                        parents: 1,
                    },
                    fun: XcmV3MultiassetFungibility.Fungible(100_000_000n),
                }]),
                XcmV5Instruction.ClearOrigin(),
                XcmV5Instruction.BuyExecution({
                    fees: {
                        id: {
                            interior: XcmV5Junctions.X2([
                                XcmV5Junction.GlobalConsensus(network),
                                XcmV5Junction.Parachain(2313),
                            ]),
                            parents: 1,
                        },
                        fun: XcmV3MultiassetFungibility.Fungible(1n),
                    },
                    weight_limit: XcmV3WeightLimit.Unlimited(),
                }),
                XcmV5Instruction.DepositAsset({
                    assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
                    beneficiary: {
                        interior: XcmV5Junctions.X1(
                            XcmV5Junction.AccountKey20({ key: Binary.fromHex("0x302f0b71b8ad3cf6dd90adb668e49b2168d652fd") })
                        ),
                        parents: 0,
                    }
                }),
                setTopic,
            ],
        }),
        setTopic,
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
    const origin = Enum("system", Enum("Signed", aliceAddress));
    const dryRunResult: any = await api.apis.DryRunApi.dry_run_call(origin, tx.decodedCall, XCM_VERSION);
    console.dir(dryRunResult.value, { depth: null });

    client.destroy();
}

main().catch(console.error);