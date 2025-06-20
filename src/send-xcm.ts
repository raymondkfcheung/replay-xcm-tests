import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

async function main() {
    const provider = new WsProvider('ws://localhost:8000');
    const api = await ApiPromise.create({ provider });

    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    const tx = api.tx.polkadotXcm.send(
        {
            V5: {
                parents: 1,
                interior: 'Here'
            }
        },
        {
            V5: [
                { SetTopic: '0x' + '00'.repeat(28) + '12345678' }
            ]
        }
    );

    console.log('Submitting extrinsic:', tx.toHuman());

    await new Promise<void>(async (resolve) => {
        const unsub = await tx.signAndSend(alice, ({ status, events, dispatchError }) => {
            if (status.isInBlock) {
                console.log('📦 Included in block:', status.asInBlock.toHex());
            } else if (status.isFinalized) {
                console.log('✅ Finalised in block:', status.asFinalized.toHex());
                unsub();
                resolve();
            }

            if (dispatchError) {
                if (dispatchError.isModule) {
                    const decoded = api.registry.findMetaError(dispatchError.asModule);
                    console.error('❌ Dispatch error:', decoded.section, decoded.name);
                } else {
                    console.error('❌ Dispatch error:', dispatchError.toString());
                }
            }

            for (const { event } of events) {
                console.log('📣 Event:', event.section, event.method, event.data.toHuman());
            }
        });
    });

    await api.disconnect();
}

main().catch(console.error);