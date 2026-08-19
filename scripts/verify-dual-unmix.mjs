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

const aPeriwinkle = recipe('decompose8', '#5B7EE4');
assert(weight(aPeriwinkle, 'legacy-003') > 0.02 || weight(aPeriwinkle, 'legacy-006') > 0.002,
  'A #5B7EE4 should keep a red or magenta residual');
assert(weight(aPeriwinkle, 'legacy-004') > 0.2, 'A #5B7EE4 should remain blue-dominant');

const bPeriwinkle = recipe('decomposeMixboxInverse', '#5B7EE4');
assert(reconstruct(bPeriwinkle) === '#5B7EE4', 'B should reconstruct #5B7EE4 exactly');
assert(
  weight(bPeriwinkle, 'legacy-003') +
    weight(bPeriwinkle, 'legacy-006') +
    weight(bPeriwinkle, 'legacy-005') +
    weight(bPeriwinkle, 'legacy-008') >
    0.003,
  'B #5B7EE4 should keep a small non-blue residual'
);

const bCornflower = recipe('decomposeMixboxInverse', '#7B93D3');
assert(reconstruct(bCornflower) === '#7B93D3', 'B should reconstruct #7B93D3 exactly');
assert(weight(bCornflower, 'legacy-003') > 0.02, 'B #7B93D3 should keep a red residual');

const grayA = recipe('decompose8', '#808080');
const grayB = recipe('decomposeMixboxInverse', '#808080');
assert(grayA.slice(2).every(item => item.weight === 0), 'A gray should be white+black');
assert(grayB.slice(2).every(item => item.weight === 0), 'B gray should be white+black');

const dusty = recipe('decompose8', '#8D93AD');
assert(weight(dusty, 'legacy-004') > 0.15, '#8D93AD should keep a substantial blue');
assert(weight(dusty, 'legacy-003') > 0.03 || weight(dusty, 'legacy-006') > 0.002,
  '#8D93AD should keep a reddish residual');

console.log('verify-dual-unmix: ok');
