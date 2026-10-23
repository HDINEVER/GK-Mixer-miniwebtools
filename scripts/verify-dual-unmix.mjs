/**
 * Dual-path unmix sanity checks against the iOS JS bundle.
 * Run after `npm run build:ios-algorithms`.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.resolve(root, '../GK-Mixer/GK-Mixer/Resources/gk-color-algorithms.js');
const sandbox = { console, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(bundlePath, 'utf8'), sandbox);

const invoke = (method, payload) =>
  JSON.parse(sandbox.GKColorAlgorithms.invoke(JSON.stringify({ method, payload })));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const recipe = (method, hex) => invoke(method, { hex, colorSpace: 'srgb' }).value;
const weight = (components, id) => components.find(item => item.id === id)?.weight ?? 0;
const reconstruct = (components) =>
  invoke('mixMulti', {
    colors: components
      .filter(item => item.weight > 1e-6)
      .map(item => ({ hex: item.hex, weight: item.weight })),
  }).value.hex;

const assertPureColorSourceOnly = (components, label) => {
  assert(
    weight(components, 'legacy-003') === 0 && weight(components, 'legacy-004') === 0,
    `${label} should strictly zero out solid Red (legacy-003) and solid Blue (legacy-004) in the Pure Color Source system`
  );
};

// Mode A (decompose8 / HSB 纯色源模式): strictly removes solid Red (003), solid Blue (004), solid Yellow (005)
const aPeriwinkle = recipe('decompose8', '#5B7EE4');
assertPureColorSourceOnly(aPeriwinkle, 'A #5B7EE4');
assert(weight(aPeriwinkle, 'legacy-007') > 0.08 && weight(aPeriwinkle, 'legacy-006') > 0.08,
  'A #5B7EE4 should use Cyan (033) + Magenta (034) in Pure Color Source mode');

// Mode B (decomposeMixboxInverse / 普通 Mixbox 模式): keeps solid Red (003), Blue (004), Yellow (005)
const bPeriwinkle = recipe('decomposeMixboxInverse', '#5B7EE4');
assert(reconstruct(bPeriwinkle) === '#5B7EE4', 'B should reconstruct #5B7EE4 exactly');
assert(weight(bPeriwinkle, 'legacy-004') > 0.15, 'B #5B7EE4 should use solid Blue (004) in standard Mixbox mode');

const bCornflower = recipe('decomposeMixboxInverse', '#7B93D3');
assert(reconstruct(bCornflower) === '#7B93D3', 'B should reconstruct #7B93D3 exactly');

const grayA = recipe('decompose8', '#808080');
const grayB = recipe('decomposeMixboxInverse', '#808080');
assert(grayA.slice(2).every(item => item.weight === 0), 'A gray should be white+black');
assert(grayB.slice(2).every(item => item.weight === 0), 'B gray should be white+black');

const dusty = recipe('decompose8', '#8D93AD');
assertPureColorSourceOnly(dusty, '#8D93AD');
assert(weight(dusty, 'legacy-007') > 0.05 && weight(dusty, 'legacy-006') > 0.05,
  '#8D93AD should use Cyan (033) + Magenta (034) in Pure Color Source mode');
assert(weight(dusty, 'legacy-008') === 0 && weight(dusty, 'legacy-005') === 0,
  '#8D93AD should never contain opposite-hue Orange or Yellow');

// Verify Screenshot 1 bug fix in standard Mixbox mode (#2F6CD9)
const skyBlue = recipe('decomposeMixboxInverse', '#2F6CD9');
assert(weight(skyBlue, 'legacy-008') === 0 && weight(skyBlue, 'legacy-005') === 0,
  '#2F6CD9 should have zero Orange and Yellow');
assert(!(weight(skyBlue, 'legacy-003') > 0 && weight(skyBlue, 'legacy-006') > 0),
  '#2F6CD9 should not mix both Red and Magenta simultaneously');

// Verify Pure Color Source mode (decompose8) and Standard Mixbox mode (decomposeMixboxInverse) with 10-slot palette
const recipePureFull = (hex, useSecondaryColors) =>
  invoke('decompose8', {
    hex,
    colorSpace: 'srgb',
    useSecondaryColors,
    includeFullSecondaryPalette: true,
  }).value;

const recipeMixboxFull = (hex, useSecondaryColors) =>
  invoke('decomposeMixboxInverse', {
    hex,
    colorSpace: 'srgb',
    useSecondaryColors,
    includeFullSecondaryPalette: true,
  }).value;

// 1. Orange (#FF6B1A): Pure Color Source mode strictly zeroes 003/004; Mixbox mode uses 015 Orange when ON, 003 Red + 005 Yellow when OFF
const orangePureOn = recipePureFull('#FF6B1A', true);
assertPureColorSourceOnly(orangePureOn, 'Orange Pure ON');
assert(weight(orangePureOn, 'legacy-008') > 0.4, 'Orange Pure ON should use Source Orange (015)');
const orangePureOff = recipePureFull('#FF6B1A', false);
assertPureColorSourceOnly(orangePureOff, 'Orange Pure OFF');
assert(weight(orangePureOff, 'legacy-008') === 0, 'Orange Pure OFF should zero out Source Orange');
assert(weight(orangePureOff, 'legacy-006') > 0.1 && weight(orangePureOff, 'legacy-005') > 0.1,
  'Orange Pure OFF should fall back to Source Magenta (034) + Source Yellow (035)');
const orangeMixboxOff = recipeMixboxFull('#FF6B1A', false);
assert(weight(orangeMixboxOff, 'legacy-003') > 0.1 && weight(orangeMixboxOff, 'legacy-005') > 0.1,
  'Orange Mixbox OFF should use solid Red (003) + solid Yellow (005)');

// 2. Green (#2BAE66): with secondary ON, uses Source Green (036 / legacy-009); OFF falls back to Cyan (033) + Yellow
const greenOn = recipeMixboxFull('#2BAE66', true);
assert(weight(greenOn, 'legacy-009') > 0.15, 'Green ON should use Source Green (legacy-009 / 036)');
assert(!(weight(greenOn, 'legacy-007') > 0 && weight(greenOn, 'legacy-005') > 0),
  'Green ON should replace Cyan+Yellow (never Cyan + Yellow + Green all 3 together)');
const greenOff = recipeMixboxFull('#2BAE66', false);
assert(weight(greenOff, 'legacy-009') === 0, 'Green OFF should zero out Source Green');
assert(weight(greenOff, 'legacy-007') > 0.1 && weight(greenOff, 'legacy-005') > 0.1,
  'Green OFF should fall back to Cyan + Yellow');

// 3. Purple (#7B3FE4): Pure Color Source mode zeroes 003/004; Mixbox mode uses Purple (037) when ON, Blue (004) + Magenta (034) when OFF
const purplePureOff = recipePureFull('#7B3FE4', false);
assertPureColorSourceOnly(purplePureOff, 'Purple Pure OFF');
assert(weight(purplePureOff, 'legacy-007') > 0.1 && weight(purplePureOff, 'legacy-006') > 0.1,
  'Purple Pure OFF should use Cyan (033) + Magenta (034) without solid Blue');
const purpleMixboxOff = recipeMixboxFull('#7B3FE4', false);
assert(weight(purpleMixboxOff, 'legacy-004') > 0.1 && weight(purpleMixboxOff, 'legacy-006') > 0.1,
  'Purple Mixbox OFF should use solid Blue (004) + Magenta (034)');

console.log('verify-dual-unmix: ok');
