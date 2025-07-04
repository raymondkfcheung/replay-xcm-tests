import { getPolkadotSigner } from "polkadot-api/signer"
import { Builder } from "@paraspell/sdk";
import {
    DEV_PHRASE,
    entropyToMiniSecret,
    mnemonicToEntropy,
    ss58Address
} from "@polkadot-labs/hdkd-helpers"
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { exit } from "process";

const toHuman = (_key: any, value: any) => {
    if (typeof value === 'bigint') {
        return Number(value);
    }

    if (value && typeof value === "object" && typeof value.asHex === "function") {
        return value.asHex();
    }

    return value;
};

// https://hackmd.io/@n9QBuDYOQXG-nWCBrwx8YQ/r1jeFflrge#Signing-with-the-seed-phrase

// WND has 12 decimals.
const WND_UNITS = 1_000_000_000_000n;
// The RPC endpoints to connect to Westend.
// Not needed if using Polkadot.
const WESTEND_AH_RPC = "ws://localhost:8000";

// Do the actual teleport. We defer the functionality to a function.
teleport();

async function teleport() {
    // We build a signer.
    const signer = getSigner();
    // We build the teleport transaction.
    const tx = await Builder([WESTEND_AH_RPC])
        .from("AssetHubPolkadot")
        .to("Polkadot")
        // We send 10 WND.
        // The symbol is DOT but because we're pointing to
        // Westend it will be interpreted correctly.
        // If using Polkadot you only need to change the units.
        .currency({ symbol: "DOT", amount: 10n * WND_UNITS })
        // To the same address on the different chain.
        .address(ss58Address(signer.publicKey))
        .build();

    // Sign the tx and submit it.
    const result: any = await tx.signAndSubmit(signer);
    if (result.ok) {
        console.log(`📦 Finalised in block #${result.block.number}: ${result.block.hash}`);
        for (const event of result.events) {
            console.log("📣 Event:", event.type, JSON.stringify(event.value, toHuman, 2));
        }
        console.log("✅ Teleport successful!");
    } else {
        console.error("❌ Teleport failed:", result.error);
    }

    exit(0);
}

function getSigner() {
    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const miniSecret = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(miniSecret);
    const alice = derive("//Alice");

    return getPolkadotSigner(alice.publicKey, "Sr25519", alice.sign);
}
