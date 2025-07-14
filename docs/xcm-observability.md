# 🔭 XCM Observability

When sending XCMs using `limited_reserve_transfer_assets` or other calls from the  `PolkadotXcm` pallet, two observability features help trace and correlate messages across chains:

* [`SetTopic([u8; 32])`](https://paritytech.github.io/polkadot-sdk/master/staging_xcm/v5/opaque/type.Instruction.html#variant.SetTopic) - An XCM instruction that sets the Topic Register. This 32-byte array is used as the `message_id`, which appears in both `Sent` and `Processed` events. The topic enables logical grouping or filtering of related XCMs across multiple hops.
  > ⚠️ **Note**: The topic is **not guaranteed to be unique**. If uniqueness is required (e.g. for deduplication or tracing), it must be enforced by the message creator.
* **`message_id`** - A hash emitted in both the[`PolkadotXcm.Sent`](https://paritytech.github.io/polkadot-sdk/master/pallet_xcm/pallet/enum.Event.html#variant.Sent) event (on the origin chain) and the [`MessageQueue.Processed`](https://paritytech.github.io/polkadot-sdk/master/pallet_message_queue/pallet/enum.Event.html#variant.Processed) event (on the destination chain). While this ID is not globally unique, it **suffices to correlate a `Sent` message with its matching `Processed` result**.

## 🔄 Message Lifecycle

### ▶️ Execute Sample Script

Assuming you're familiar with how to replay a forked chain using [Chopsticks](https://docs.polkadot.com/develop/toolkit/parachains/fork-chains/chopsticks/get-started/). If not, refer to the [guide](../README.md) for setup instructions.

* [`limited-reserve-transfer-assets.ts`](../src/limited-reserve-transfer-assets.ts)

```bash
npx ts-node src/limited-reserve-transfer-assets.ts
```

### ✅ Local XCM (on origin chain - e.g., Polkadot Asset Hub)

```json
{
  "type": "TransferAsset",
  "value": {
    "assets": [...],
    "beneficiary": {...}
  }
}
```

### 🚀 Forwarded XCM (to destination - e.g., Acala)

The runtime automatically appends a `SetTopic`:

```json
[
  {
    "type": "ReserveAssetDeposited",
    "value": [...]
  },
  {
    "type": "ClearOrigin"
  },
  {
    "type": "BuyExecution",
    "value": {...}
  },
  {
    "type": "DepositAsset",
    "value": {...}
  },
  {
    "type": "SetTopic",
    "value": "0x85e46e75d9dbb211da2fb28106028960fdd916fbe9fdda3665ae00403abe2aae"
  }
]
```

This forwarded message lands on the destination chain (Acala) and is processed accordingly.

### 🔍 Event Correlation Flow

| Chain              | Event                   | Field        | Description                                         |
| ------------------ | ----------------------- | ------------ | --------------------------------------------------- |
| Polkadot Asset Hub | `PolkadotXcm.Sent`      | `message_id` | Message ID derived from `SetTopic`                  |
| Acala              | `MessageQueue.Processed`| `id`         | Should match the `message_id` from the origin chain |

### 🛠 Example: Message Trace Output

```console
✅ Local dry run successful.
📦 Finalised on Polkadot Asset Hub in block #9079592: 0x6de0cd268f07ec040a69dbbcb81f86c6fc4954dfa7fc914edd5dae1e3f235083
📣 Last message Sent on Polkadot Asset Hub: 0xb4b8d2c87622cbad983d8f2c92bfe28e12d587e13d15ea4fdabe8f771bf86bce
📦 Finalised on Acala in block #8826386: 0xfda51e7e411ee59c569fc051ef51431b04edebcc5d45d7b1d1bdfcce9627638a
📣 Last message Processed on Acala: 0xb4b8d2c87622cbad983d8f2c92bfe28e12d587e13d15ea4fdabe8f771bf86bce
✅ Message ID matched.
```

### 🚨 Failure Event Handling

**Important:** When an XCM transaction fails, it is **rolled back**, meaning **no failure events are emitted on-chain**. However, failure details are still observable through other methods.

#### 📦 Indexer View: Nested Error Only

Most indexers will display **nested error information**, such as `LocalExecutionIncompleteWithError`. This can be helpful for high-level diagnosis, and is **usually sufficient** to understand what went wrong.

#### 🧪 Deeper Insight: Use Chopsticks for Full Detail

For **in-depth debugging**, especially when the nested error is vague, use [`Chopsticks`](https://github.com/AcalaNetwork/chopsticks):

* Run a replay with full logging to see **which instruction failed**, and why.
* View inner `FailedToTransactAsset`, `AssetNotFound` or other details.
* Supports debugging multi-hop XCMs and complex failure scenarios.

Example:

```json
"error": {
  "type": "Module",
  "value": {
    "type": "PolkadotXcm",
    "value": {
      "type": "LocalExecutionIncompleteWithError",
      "value": {
        "index": 0,
        "error": {
          "type": "FailedToTransactAsset"
        }
      }
    }
  }
}
```

#### 🛠 Recommended Debugging Workflow

1. **Look at the indexer first** to see if the nested error gives enough context.
2. If not, **run a replay in Chopsticks** with logging enabled.
3. Check node logs to correlate where and why execution failed.
4. Analyse inner errors (e.g., weight too low, asset mismatch, missing buy execution).

➡️ For full logging setup, see [this guide](https://github.com/polkadot-developers/polkadot-docs/pull/734).

## 🧠 Notes

* `SetTopic` is always **appended as the final instruction** in the XCM by the runtime.
* You do **not** need to include `SetTopic` manually when using standard extrinsics like `limited_reserve_transfer_assets`. The runtime handles this automatically.
* If you construct and submit XCMs manually using `execute`, you **can specify your own `SetTopic`** to group or identify messages logically.
* For testing or tracing, you may **inject a custom topic** by adding a `SetTopic([u8; 32])` instruction yourself. This is especially useful when crafting raw XCMs.

## 📚 References

* [polkadot-sdk#6119 - [XCM] Observability & Debuggability](https://github.com/paritytech/polkadot-sdk/issues/6119)
* [polkadot-sdk#7234 - Add EventEmitter to XCM Executor](https://github.com/paritytech/polkadot-sdk/pull/7234)
* [polkadot-sdk#7730 - Nest Errors in `pallet-xcm`](https://github.com/paritytech/polkadot-sdk/pull/7730)
* [polkadot-sdk#7691 - Ensure Consistent Topic IDs for Traceable Cross-Chain XCM](https://github.com/paritytech/polkadot-sdk/pull/7691)
* [polkadot-docs#734 - Add Guide: Replay & Dry Run XCMs with Full Logging Using Chopsticks](https://github.com/polkadot-developers/polkadot-docs/pull/734)
