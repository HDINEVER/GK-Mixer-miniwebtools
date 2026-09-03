import { toDropRatio, formatDropRatioLine } from '../utils/dropRatio.ts';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const same = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

assert(same(toDropRatio([1]), [1]), 'single pigment is 1');
assert(same(toDropRatio([0.5, 0.5]), [1, 1]), 'equal mix is 1:1');
assert(same(toDropRatio([2, 1]), [2, 1]), '2:1 stays 2:1');
assert(same(toDropRatio([66, 33]), [2, 1]), '66/33 collapses to 2:1');
assert(same(toDropRatio([0, 0.5, 0.5]), [0, 1, 1]), 'zeros stay excluded');
assert(same(toDropRatio([0.9, 0.1]), [9, 1]), '9:1 keeps a tint drop');

const three = toDropRatio([0.47, 0.31, 0.22]);
assert(same(three, [4, 3, 2]), '47/31/22 becomes 4:3:2');

const gray = toDropRatio([50.2, 49.8]);
assert(same(gray, [1, 1]), 'near-even gray is 1:1');

assert(
  formatDropRatioLine([
    { name: '白', drops: 3 },
    { name: '蓝', drops: 5 },
    { name: '品红', drops: 1 },
  ]) === '白 3 : 蓝 5 : 品红 1',
  'ratio line uses names and colons'
);

console.log('verify-drop-ratio: ok', {
  equal: toDropRatio([0.5, 0.5]),
  twoOne: toDropRatio([2, 1]),
  tint: toDropRatio([0.9, 0.1]),
  three,
});
