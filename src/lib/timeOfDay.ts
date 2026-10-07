/**
 * The room keeps the visitor's own hours: a bright window in the daytime,
 * the original blue hour around dawn and dusk, and a dark one at night
 * (when the desk lamp starts switched on).
 *
 * Read once per page load from the local clock. `?time=day|dusk|night`
 * overrides it, for previews and screenshots.
 *
 * Dusk is the scene as it was designed — every multiplier 1 and every
 * colour the original — except the window glass, which was raised for dusk
 * and night: at its old values it read as a black hole in the wall rather
 * than a sky.
 */
export type TimeOfDay = 'day' | 'dusk' | 'night';

function detect(): TimeOfDay {
  if (typeof window !== 'undefined') {
    const forced = new URLSearchParams(window.location.search).get('time');
    if (forced === 'day' || forced === 'dusk' || forced === 'night') return forced;
  }
  const h = new Date().getHours();
  if (h >= 7 && h < 17) return 'day';
  if (h >= 20 || h < 5) return 'night';
  return 'dusk';
}

export const timeOfDay: TimeOfDay = detect();

export interface TimePalette {
  /** Window glass. */
  glassColor: string;
  glassEmissive: string;
  glassEmissiveScale: number;
  /** The light that comes in through the window, and its visible shaft. */
  windowLightColor: string;
  windowLightScale: number;
  shaftColor: string;
  shaftOpacityScale: number;
  /** Sky/fog seen outside, before the door. */
  exteriorColor: string;
  exteriorAmbientScale: number;
  porchScale: number;
  /** Indoor light levels. */
  keyScale: number;
  ambientScale: number;
  fillColor: string;
  fillScale: number;
}

const PALETTES: Record<TimeOfDay, TimePalette> = {
  day: {
    glassColor: '#9cc3e6',
    glassEmissive: '#cfe6fb',
    glassEmissiveScale: 1.5,
    windowLightColor: '#fff1d6',
    windowLightScale: 1.6,
    shaftColor: '#fff3dc',
    shaftOpacityScale: 1.15,
    exteriorColor: '#8fb2d1',
    exteriorAmbientScale: 1.7,
    porchScale: 0.35,
    keyScale: 1.25,
    ambientScale: 1.3,
    fillColor: '#bcd6ee',
    fillScale: 1.2,
  },
  dusk: {
    glassColor: '#24384d',
    glassEmissive: '#4a7091',
    glassEmissiveScale: 1.4,
    windowLightColor: '#5b7fa6',
    windowLightScale: 1,
    shaftColor: '#cfe0ee',
    shaftOpacityScale: 1,
    exteriorColor: '#22303f',
    exteriorAmbientScale: 1,
    porchScale: 1,
    keyScale: 1,
    ambientScale: 1,
    fillColor: '#7fa3c4',
    fillScale: 1,
  },
  night: {
    glassColor: '#17253d',
    glassEmissive: '#36598f',
    glassEmissiveScale: 1.1,
    windowLightColor: '#41598a',
    windowLightScale: 0.6,
    shaftColor: '#8ea6cc',
    shaftOpacityScale: 0.35,
    exteriorColor: '#0d1520',
    exteriorAmbientScale: 0.6,
    porchScale: 1.15,
    keyScale: 0.55,
    ambientScale: 0.7,
    fillColor: '#4a6488',
    fillScale: 0.6,
  },
};

export const timePalette: TimePalette = PALETTES[timeOfDay];
