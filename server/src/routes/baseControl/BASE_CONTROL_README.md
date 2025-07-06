# Base Control Implementation Notes

## Current State
The base control API is currently implemented as a **simulation only**. It stores the desired positions in memory and simulates movement delays, but does not actually communicate with any hardware.

## What's Missing for Real Hardware Control

Based on the decompiled capybara source analysis, actual base control requires:

### 1. BLE Communication
- Connect to the adjustable base via Bluetooth Low Energy
- Use service UUID: `0000ffe0-0000-1000-8000-00805f9b34fb`
- Write to characteristic: `0000ffe1-0000-1000-8000-00805f9b34fb`

### 2. TriMix Protocol Implementation
The TriMix bed frame uses a specific protocol:
- Command structure: 18-byte payloads starting with `[255, 255, 255, 255, 1, 0]`
- Position commands use command byte `33` followed by:
  - Feed rate (speed): 30-100
  - Motor selection: 1-6 (left/right leg/torso or synchronized)
  - Position in ticks (not degrees)

### 3. Angle to Ticks Conversion
- Head/Torso: 0-60° maps to 0-2253 ticks (non-linear)
- Feet/Legs: 0-45° maps to 0-1806 ticks (non-linear)

### 4. Required Commands
```
SET_TORSO_ANGLE: Command 33, motor 6
SET_LEG_ANGLE: Command 33, motor 5
STOP: Command 35 or special stop payload
GET_STATUS: Command 34
```

## To Enable Real Control

1. **No additional dependencies needed** - uses built-in bluetoothctl

2. **BLE service** that:
   - Scans for TriMix devices
   - Connects to the base
   - Implements the TriMix protocol

3. **Replace the simulation** in `baseControl.ts` with actual BLE commands

4. **Add safety features**:
   - Movement sensor detection
   - Emergency stop capability
   - Position limits enforcement
   - Connection status monitoring

## Security Considerations
- Base control should require authentication
- Movement commands should have timeouts
- Emergency stop should always be available
- Position limits must be enforced in software

## Testing
Currently, you can test the API simulation:
- Movement status changes to `true` immediately
- After 5 seconds, movement status returns to `false`
- Position values are stored and returned correctly