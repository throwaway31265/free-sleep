# Adjustable Base Bluetooth Control Guide (Final)

This guide provides the verified commands for controlling the adjustable base using `bluetoothctl` and explains how to interpret the device's status notifications.

---

## 1. Understanding the Communication

This device uses two primary Bluetooth characteristics:

-   **Write Characteristic (`.../char000f`, UUID `...ffe3-`):** You send all commands *to* this characteristic.
-   **Notify Characteristic (`.../char0009`, UUID `...ffe1-`):** The bed continuously broadcasts its status *from* this characteristic. You do not need to query for state; you only need to listen.

The bed alternates between sending two types of status packets:
1.  **Position State Packet:** Contains the current position (in ticks) of the motors.
2.  **System Flags Packet:** Contains the status of the motors and sensors.

---

## 2. How to Control the Bed

### Step 1: Connect and Listen

1.  Enter the `bluetoothctl` utility:
    ```bash
    bluetoothctl
    ```
2.  Connect to the base:
    ```
    connect 3C:A5:51:9B:27:CA
    ```
3.  Enter the GATT menu:
    ```
    menu gatt
    ```
4.  Select the **Notify Characteristic** and turn on notifications. This is how you will see the bed's status in real-time.
    ```
    select-attribute /org/bluez/hci0/dev_3C_A5_51_9B_27_CA/service0008/char0009
    notify on
    ```
    You will immediately start seeing a stream of `[CHG]` messages.

### Step 2: Send Commands

1.  Select the **Write Characteristic** to send commands.
    ```
    select-attribute /org/bluez/hci0/dev_3C_A5_51_9B_27_CA/service0008/char000f
    ```
2.  Use the commands below to control the bed.

---

## 3. Verified Commands

These commands can be generated reliably using the `generate_command.ts` script.

**Set Torso Angle to 20 Degrees (Feed Rate 50):**
```
write "0xff 0xff 0xff 0xff 0x01 0x00 0x21 0x14 0x32 0x06 0x15 0x02 0x00 0x00 0x00 0x00 0x00 0x00 0x81 0x04"
```

**Set Leg Angle to 15 Degrees (Feed Rate 50):**
```
write "0xff 0xff 0xff 0xff 0x01 0x00 0x21 0x14 0x32 0x05 0x1c 0x02 0x00 0x00 0x00 0x00 0x00 0x00 0x87 0x04"
```

**Move Torso to Flat (0 Degrees, Feed Rate 50):**
```
write "0xff 0xff 0xff 0xff 0x01 0x00 0x21 0x14 0x32 0x06 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x6a 0x04"
```

**Move Leg to Flat (0 Degrees, Feed Rate 50):**
```
write "0xff 0xff 0xff 0xff 0x01 0x00 0x21 0x14 0x32 0x05 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x69 0x04"
```

**Stop All Movement (Special Command):**
This is a special 13-byte command that will stop all motors immediately.
```
write "0xff 0xff 0xff 0xff 0x05 0x00 0x00 0x00 0x00 0xd7 0x00 0xd8 0x04"
```

---

## 4. Interpreting the Notification Data

When you have notifications turned on for `.../char0009`, you will see a stream of data. Here is how to interpret it based on the C# source code:

**Example Notification:**
`[CHG] Attribute ... Value: ff ff ff ff 01 00 22 14 ...`

The 7th byte (index 6) tells you the packet type:
*   If it's `0x22`, it's a **Position State Packet**.
*   If it's `0x19`, it's a **System Flags Packet**.

### Position State Packet (`0x22`)

`ff ff ff ff 01 00 22 14 [..] [LL LL] [LT LT] [RL RL] [RT RT] [..] [CS CS]`

*   `LL LL`: Leg Left Ticks (2 bytes, little-endian)
*   `LT LT`: Leg Torso Ticks (2 bytes, little-endian)
*   `RL RL`: Right Leg Ticks (2 bytes, little-endian)
*   `RT RT`: Right Torso Ticks (2 bytes, little-endian)

### System Flags Packet (`0x19`)

`ff ff ff ff 01 00 19 14 [MS] [..] [..] [LTS] [LLS] [RTS] [RLS] [..] [CS CS]`

*   `MS` (Byte 8): Movement Sensor (`0x01` if triggered)
*   `LTS` (Byte 11): Left Torso Status
*   `LLS` (Byte 12): Left Leg Status
*   `RTS` (Byte 9): Right Torso Status
*   `RLS` (Byte 10): Right Leg Status

**Motor Status Codes:**
*   `0`: Working
*   `1`: Stalling
*   `2`: Overload
*   `3`: Spike Overload
*   `4`: Low Power Spike Overload
*   `5`: Broken
*   `6`: Lost Tick Tracking
*   `7`: Hall Mismatch
*   `8`: Side Sync

This guide should now provide a complete and accurate reference for controlling and understanding the adjustable base.
