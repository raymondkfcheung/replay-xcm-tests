import { Binary, createClient, Enum } from "polkadot-api";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import {
    assetHub,
    XcmV3MultiassetFungibility,
    XcmV3WeightLimit,
    XcmV5AssetFilter,
    XcmV5Instruction,
    XcmV5Junctions,
    XcmV5WildAsset,
    XcmV5Junction,
    XcmVersionedXcm,
} from "@polkadot-api/descriptors";
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } from "@polkadot-labs/hdkd-helpers";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

const UNIT = 1_000_000_000_000n;

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

    const allAssets = XcmV5AssetFilter.Wild(XcmV5WildAsset.All());
    const assetHubDest = {};
    const dotAssetId = {
        interior: XcmV5Junctions.Here(),
        parents: 1,
    }
    const dotAsset = {
        id: dotAssetId,
        fun: XcmV3MultiassetFungibility.Fungible(UNIT),
    };
    const dotAssetSwapFilter = {};
    const dotFeeAsset = {
        id: dotAssetId,
        fun: XcmV3MultiassetFungibility.Fungible(UNIT),
    };
    const hydradxDest = {
        interior: XcmV5Junctions.X1(
            XcmV5Junction.Parachain(2034)
        ),
        parents: 1,
    };
    const usdtAsset = {
        id: {
            parents: 0,
            interior: XcmV5Junctions.X2([
                XcmV5Junction.PalletInstance(50),
                XcmV5Junction.GeneralIndex(1984n),
            ]
            ),
        },
        fun: XcmV3MultiassetFungibility.Fungible(500_000_000n),
    };
    const message = XcmVersionedXcm.V5([
        // 1. Withdraw DOT from Asset Hub
        XcmV5Instruction.WithdrawAsset([dotAsset]),

        // 2. Deposit to HydraDX with instructions
        XcmV5Instruction.DepositReserveAsset({
            assets: allAssets,
            dest: hydradxDest,
            xcm: [
                // 2a. Pay for execution on HydraDX
                XcmV5Instruction.BuyExecution({
                    fees: dotFeeAsset,
                    weight_limit: XcmV3WeightLimit.Unlimited()
                }),

                // 2b. Exchange DOT for USDT
                XcmV5Instruction.ExchangeAsset({
                    give: dotAssetSwapFilter,
                    want: [usdtAsset],
                    maximal: true
                }),

                // 2c. Send swapped assets (USDT) back to Asset Hub
                XcmV5Instruction.InitiateReserveWithdraw({
                    assets: allAssets,
                    reserve: assetHubDest,
                    xcm: [
                        XcmV5Instruction.BuyExecution({
                            fees: dotFeeAsset,
                            weight_limit: XcmV3WeightLimit.Unlimited()
                        }),
                        XcmV5Instruction.DepositAsset({
                            assets: allAssets,
                            beneficiary: {
                                interior: XcmV5Junctions.X1(
                                    XcmV5Junction.AccountKey20({ key: Binary.fromHex("0x302f0b71b8ad3cf6dd90adb668e49b2168d652fd") })
                                ),
                                parents: 0,
                            }
                        })
                    ]
                }),
            ]
        })
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
