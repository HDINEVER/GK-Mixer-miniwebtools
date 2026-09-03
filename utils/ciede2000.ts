/** sRGB D65 Lab + CIEDE2000, matching iOS CIEDE2000.swift and the catalog importer. */

export interface Lab {
  l: number;
  a: number;
  b: number;
}

const linearize = (channel: number) => {
  const c = channel / 255;
  return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
};

const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export const labFromRgb = (r: number, g: number, b: number): Lab => {
  const rLin = linearize(r);
  const gLin = linearize(g);
  const bLin = linearize(b);
  const x = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) * 100;
  const y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.072175) * 100;
  const z = (rLin * 0.0193339 + gLin * 0.119192 + bLin * 0.9503041) * 100;
  const xN = labF(x / 95.047);
  const yN = labF(y / 100);
  const zN = labF(z / 108.883);
  return {
    l: 116 * yN - 16,
    a: 500 * (xN - yN),
    b: 200 * (yN - zN),
  };
};

export const rgbFromHex = (hex: string): { r: number; g: number; b: number } | null => {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
};

export const labFromHex = (hex: string): Lab | null => {
  const rgb = rgbFromHex(hex);
  return rgb ? labFromRgb(rgb.r, rgb.g, rgb.b) : null;
};

export const deltaE2000 = (lhs: Lab, rhs: Lab, kL = 1, kC = 1, kH = 1): number => {
  const { l: l1, a: a1, b: b1 } = lhs;
  const { l: l2, a: a2, b: b2 } = rhs;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const cBar7 = cBar ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 6103515625)));

  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);

  let h1p = Math.atan2(b1, a1p);
  if (h1p < 0) h1p += 2 * Math.PI;
  if (a1p === 0 && b1 === 0) h1p = 0;

  let h2p = Math.atan2(b2, a2p);
  if (h2p < 0) h2p += 2 * Math.PI;
  if (a2p === 0 && b2 === 0) h2p = 0;

  const dLp = l2 - l1;
  const dCp = c2p - c1p;

  let dhp = h2p - h1p;
  if (c1p * c2p === 0) {
    dhp = 0;
  } else if (dhp > Math.PI) {
    dhp -= 2 * Math.PI;
  } else if (dhp < -Math.PI) {
    dhp += 2 * Math.PI;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(dhp / 2);

  let hp = (h1p + h2p) / 2;
  if (c1p * c2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) > Math.PI) {
    if (h1p + h2p < 2 * Math.PI) hp += Math.PI;
    else hp -= Math.PI;
  }

  const lBarp = (l1 + l2) / 2;
  const cBarp = (c1p + c2p) / 2;
  const t =
    1 -
    0.17 * Math.cos(hp - Math.PI / 6) +
    0.24 * Math.cos(2 * hp) +
    0.32 * Math.cos(3 * hp + Math.PI / 30) -
    0.2 * Math.cos(4 * hp - (63 * Math.PI) / 180);

  const hueDeg = (hp * 180) / Math.PI;
  const dTheta = ((30 * Math.PI) / 180) * Math.exp(-Math.pow((hueDeg - 275) / 25, 2));
  const cBarp7 = cBarp ** 7;
  const rc = 2 * Math.sqrt(cBarp7 / (cBarp7 + 6103515625));
  const sl = 1 + (0.015 * (lBarp - 50) ** 2) / Math.sqrt(20 + (lBarp - 50) ** 2);
  const sc = 1 + 0.045 * cBarp;
  const sh = 1 + 0.015 * cBarp * t;
  const rt = -Math.sin(2 * dTheta) * rc;

  const lTerm = dLp / (kL * sl);
  const cTerm = dCp / (kC * sc);
  const hTerm = dHp / (kH * sh);
  return Math.sqrt(lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rt * cTerm * hTerm);
};
