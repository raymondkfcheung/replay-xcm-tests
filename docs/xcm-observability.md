# 🔭 XCM Observability

When sending XCMs using `limited_reserve_transfer_assets` or other calls from the `PolkadotXcm` pallet, two observability features help trace and correlate messages across chains:

* **`message_id`** – A hash that appears in both the [`PolkadotXcm.Sent`](https://paritytech.github.io/polkadot-sdk/master/pallet_xcm/pallet/enum.Event.html#variant.Sent) event (on the origin chain) and the [`MessageQueue.Processed`](https://paritytech.github.io/polkadot-sdk/master/pallet_message_queue/pallet/enum.Event.html#variant.Processed) event (on the destination chain). While this ID is not globally unique, it is sufficient to **correlate a Sent message with its corresponding Processed result**.
* [`SetTopic`](https://paritytech.github.io/polkadot-sdk/master/staging_xcm/v5/opaque/type.Instruction.html#variant.SetTopic) – An XCM instruction that sets a *topic* for the message, automatically appended by the runtime to the end of the XCM. This enables logical grouping or filtering of related XCMs across multiple hops.

  > ⚠️ **Note**: The 32-byte topic is **not guaranteed to be unique** — it's up to the message creator to ensure uniqueness if needed.

## 🔄 Message Lifecycle

### 1. ✅ Local XCM (on origin chain – e.g., Polkadot Asset Hub)

```json
{
  "type": "TransferAsset",
  "value": {
    "assets": [...],
    "beneficiary": {
      "parents": 1,
      "interior": {
        "type": "X1",
        "value": {
          "type": "Parachain",
          "value": 2000
        }
      }
    }
  }
}
```

### 2. 🚀 Forwarded XCM (to destination – e.g., Acala)

The runtime automatically appends a `SetTopic`:

```json
{
  "type": "SetTopic",
  "value": "0x85e46e75d9dbb211da2fb28106028960fdd916fbe9fdda3665ae00403abe2aae"
}
```

This forwarded message lands on the destination chain (Acala) and is processed accordingly.

### 🔍 Event Correlation Flow

| Chain              | Event                        | Field        | Description                              |
| ------------------ | ---------------------------- | ------------ | ---------------------------------------- |
| Polkadot Asset Hub | `PolkadotXcm.Sent`           | `message_id` | Message ID of the sent XCM                |
| Acala              | `MessageQueue.Processed`     | `id`         | Should match the original `message_id`   |
| Both               | `SetTopic` (in message body) | topic hash   | Used to logically group related messages |

### 🛠 Example: Message Trace Output

```console
✅ Local dry run successful.
📦 Finalised on Polkadot Asset Hub in block #9079592
📣 Last message Sent: 0xb4b8d2c87622cbad983d8f2c92bfe28e12d587e13d15ea4fdabe8f771bf86bce
📦 Finalised on Acala in block #8826386
📣 Last message Processed: 0xb4b8d2c87622cbad983d8f2c92bfe28e12d587e13d15ea4fdabe8f771bf86bce
✅ Message ID matched.
```

## 🧠 Notes

* The `SetTopic` is always **added at the last position** of the XCM instruction list.
* You don’t need to add it manually — if you’re using `limited_reserve_transfer_assets` (for instance), it’s handled automatically by the runtime.
* If you send with `execute`, you can add your custom ID.
* You can also inject custom topics for developer testing using the `SetTopic` instruction manually if you're crafting raw XCM.

## 📚 References

* [polkadot-sdk#6119 - [XCM] Observability & Debuggability](https://github.com/paritytech/polkadot-sdk/issues/6119)
* [polkadot-sdk#7234 - Add EventEmitter to XCM Executor](https://github.com/paritytech/polkadot-sdk/pull/7234)
* [polkadot-sdk#7691 - Ensure Consistent Topic IDs for Traceable Cross-Chain XCM](https://github.com/paritytech/polkadot-sdk/pull/7691)
* [polkadot-docs#734 - Add Guide: Replay & Dry Run XCMs with Full Logging Using Chopsticks](https://github.com/polkadot-developers/polkadot-docs/pull/734)
