// Run with Node 24: node --test tests/temperatureCurve.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_TEMPERATURE_F, MIN_TEMPERATURE_F, convertFromEvenSpreadF, levelToTemperatureF, temperatureFToLevel,
} from '../server/src/db/temperatureCurve.ts';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} is not ${expected}`);

test('levels give the temperatures the firmware reported aiming for', () => {
  // [level, °C] as reported by a Pod 5's firmware
  const measured = [
    [-100, 10], [-90, 16.2], [-80, 17.4], [-50, 21], [-10, 25.8], [0, 27],
    [10, 28.8], [40, 34.2], [50, 36], [60, 37.2], [90, 40.8], [100, 42],
  ];
  for (const [level, temperatureC] of measured) {
    closeTo(levelToTemperatureF(level), temperatureC * 9 / 5 + 32);
  }
  assert.equal(MIN_TEMPERATURE_F, 50);
  assert.equal(MAX_TEMPERATURE_F, 108);
});

test('a temperature converts to the nearest level, and out-of-range ones to the ends', () => {
  assert.equal(temperatureFToLevel(80.6), 0);
  assert.equal(temperatureFToLevel(96.8), 50);
  assert.equal(temperatureFToLevel(50), -100);
  assert.equal(temperatureFToLevel(40), -100);
  assert.equal(temperatureFToLevel(110), 100);
});

test('every dial setting survives being stored as a whole degree', () => {
  for (let dial = -10; dial <= 10; dial++) {
    const storedF = Math.round(levelToTemperatureF(dial * 10));
    assert.equal(Math.round(temperatureFToLevel(storedF) / 10), dial, `dial ${dial} stored as ${storedF}`);
  }
});

test('temperatures saved under the old even spread keep their level', () => {
  // Old 96°F was level 49, old 55°F was -100, old 110°F was 100, old 83°F was level 2
  assert.equal(convertFromEvenSpreadF(96), 96);
  assert.equal(convertFromEvenSpreadF(55), 50);
  assert.equal(convertFromEvenSpreadF(110), 108);
  assert.equal(convertFromEvenSpreadF(83), 81);
  assert.equal(convertFromEvenSpreadF(58), 61);
  for (let oldF = 55; oldF <= 110; oldF++) {
    const oldLevel = Math.round((oldF - 82.5) / 0.275);
    const newLevel = temperatureFToLevel(convertFromEvenSpreadF(oldF));
    // Whole degrees are coarser than levels, so the level can move slightly but never by a dial step
    assert.ok(Math.abs(newLevel - oldLevel) <= 3, `${oldF}°F: level ${oldLevel} became ${newLevel}`);
  }
});
