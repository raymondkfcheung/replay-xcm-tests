import { assetHub, AssetHubCalls, XcmV5Instruction, XcmV5Junction, XcmV5Junctions } from "@polkadot-api/descriptors";
import { Binary, createClient, Enum } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner } from "polkadot-api/signer";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { Keyring } from "@polkadot/keyring";
import { blake2AsHex, cryptoWaitReady } from '@polkadot/util-crypto';

const bigIntToJson = (_key: any, value: any) => {
    if (typeof value === 'bigint') {
        return Number(value);
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
    console.log("XCM:", JSON.stringify(message, bigIntToJson, 2));

    const weight: any = await api.apis.XcmPaymentApi.query_xcm_weight(message);
    console.log("Estimated weight:", weight);

    const tx = api.tx.PolkadotXcm.execute({
        message,
        max_weight: weight.value,
    });
    console.log("Decoded Call:", JSON.stringify(tx.decodedCall, bigIntToJson, 2));

    const result = await tx.signAndSubmit(aliceSigner);
    console.log("Transaction Result:", JSON.stringify(result, bigIntToJson, 2));

    client.destroy();
}

main().catch(console.error);
