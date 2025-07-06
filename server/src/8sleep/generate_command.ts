#!/usr/bin/env ts-node
import { exit } from "process";

// --- Configuration ---
// Angle-to-Ticks conversion maps, replicated from the C# source code.
const torsoAngleMap = new Map<number, number>([
	[0, 0],
	[1, 24],
	[2, 48],
	[3, 72],
	[4, 96],
	[5, 120],
	[6, 144],
	[7, 168],
	[8, 192],
	[9, 216],
	[10, 240],
	[11, 264],
	[12, 288],
	[13, 312],
	[14, 336],
	[15, 360],
	[16, 384],
	[17, 408],
	[18, 432],
	[19, 456],
	[20, 533],
	[21, 556],
	[22, 579],
	[23, 602],
	[24, 625],
	[25, 648],
	[26, 671],
	[27, 694],
	[28, 717],
	[29, 740],
	[30, 763],
	[31, 786],
	[32, 809],
	[33, 832],
	[34, 855],
	[35, 878],
	[36, 901],
	[37, 924],
	[38, 947],
	[39, 970],
	[40, 993],
	[41, 1016],
	[42, 1039],
	[43, 1062],
	[44, 1085],
	[45, 1108],
	[46, 1131],
	[47, 1154],
	[48, 1177],
	[49, 1200],
	[50, 1223],
	[51, 1246],
	[52, 1269],
	[53, 1292],
	[54, 1315],
	[55, 1338],
	[56, 1361],
	[57, 1384],
	[58, 1407],
	[59, 1430],
	[60, 2253],
]);

const legAngleMap = new Map<number, number>([
	[0, 0],
	[1, 38],
	[2, 76],
	[3, 114],
	[4, 152],
	[5, 190],
	[6, 222],
	[7, 254],
	[8, 286],
	[9, 318],
	[10, 350],
	[11, 404],
	[12, 458],
	[13, 512],
	[14, 566],
	[15, 540],
	[16, 594],
	[17, 648],
	[18, 702],
	[19, 756],
	[20, 740],
	[21, 784],
	[22, 828],
	[23, 872],
	[24, 916],
	[25, 960],
	[26, 1004],
	[27, 1048],
	[28, 1092],
	[29, 1136],
	[30, 1180],
	[31, 1224],
	[32, 1268],
	[33, 1312],
	[34, 1356],
	[35, 1400],
	[36, 1444],
	[37, 1488],
	[38, 1532],
	[39, 1576],
	[40, 1620],
	[41, 1664],
	[42, 1708],
	[43, 1752],
	[44, 1796],
	[45, 1806],
]);

// --- Core Functions ---

/**
 * Calculates the 2-byte little-endian checksum for a given payload.
 */
function calculateChecksum(payload: Uint8Array): Uint8Array {
	const sum = payload.reduce((acc, byte) => acc + byte, 0);
	const checksum = new Uint8Array(2);
	const view = new DataView(checksum.buffer);
	view.setUint16(0, sum, true); // true for little-endian
	return checksum;
}

/**
 * Appends a checksum to a payload to create the final packet.
 */
function buildPacketWithChecksum(payload: Uint8Array): Uint8Array {
	const checksum = calculateChecksum(payload);
	const packet = new Uint8Array(payload.length + checksum.length);
	packet.set(payload, 0);
	packet.set(checksum, payload.length);
	return packet;
}

/**
 * Formats a byte array into a hex string for bluetoothctl.
 */
function formatForBluetoothctl(packet: Uint8Array): string {
	const hexString = Array.from(packet)
		.map((b) => "0x" + b.toString(16).padStart(2, "0"))
		.join(" ");
	return `write "${hexString}"`;
}

/**
 * Creates a command to set a motor to a specific angle.
 */
function createSetAngleCommand(
	motor: "torso" | "leg",
	angle: number,
	feedRate: number,
): string {
	const payload = new Uint8Array(18).fill(0);
	const view = new DataView(payload.buffer);

	// Magic Header for standard commands
	view.setUint32(0, 0xffffffff, false);
	view.setUint8(4, 0x01);
	view.setUint8(5, 0x00);

	// Command section
	view.setUint8(6, 0x21); // Set Angle/Ticks command
	view.setUint8(7, 0x14);
	view.setUint8(8, feedRate);

	if (motor === "torso") {
		view.setUint8(9, 0x06); // Torso motor ID
		const ticks = torsoAngleMap.get(angle);
		if (ticks === undefined)
			throw new Error(`Invalid angle ${angle} for torso.`);
		view.setUint16(10, ticks, true); // Ticks (little-endian)
	} else if (motor === "leg") {
		view.setUint8(9, 0x05); // Leg motor ID
		const ticks = legAngleMap.get(angle);
		if (ticks === undefined) throw new Error(`Invalid angle ${angle} for leg.`);
		view.setUint16(10, ticks, true); // Ticks (little-endian)
	}

	const packet = buildPacketWithChecksum(payload);
	return formatForBluetoothctl(packet);
}

/**
 * Creates the special command to stop all motor movement.
 */
function createStopCommand(): string {
	// This is a special, hardcoded payload from the source code.
	const payload = new Uint8Array([255, 255, 255, 255, 5, 0, 0, 0, 0, 215, 0]);

	const packet = buildPacketWithChecksum(payload);
	return formatForBluetoothctl(packet);
}

// --- Main Execution ---

function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("Usage:");
		console.error("  ts-node generate_command.ts torso <angle> [feed_rate]");
		console.error("  ts-node generate_command.ts leg <angle> [feed_rate]");
		console.error("  ts-node generate_command.ts stop");
		console.error("\nExample:");
		console.error("  ts-node generate_command.ts torso 0");
		exit(1);
	}

	const [command, ...params] = args;
	let result = "";

	try {
		switch (command) {
			case "torso":
			case "leg": {
				if (params.length < 1)
					throw new Error(`Angle must be provided for '${command}' command.`);
				const angle = parseInt(params[0], 10);
				const feedRate = parseInt(params[1], 10) || 50; // Default feed rate to 50
				result = createSetAngleCommand(command, angle, feedRate);
				break;
			}
			case "stop":
				result = createStopCommand();
				break;
			default:
				throw new Error(
					`Unknown command: ${command}. Use 'torso', 'leg', or 'stop'.`,
				);
		}
		console.log(result);
	} catch (error) {
		console.error(`Error: ${(error as Error).message}`);
		exit(1);
	}
}

main();
