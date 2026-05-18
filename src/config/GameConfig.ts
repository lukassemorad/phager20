export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 3000;
export const WORLD_PADDING = 160;

export const PLANET_COUNT = 10;
export const MIN_PLANET_RADIUS = 28;
export const MAX_PLANET_RADIUS = 55;
export const MIN_PLANET_DISTANCE = 180;
export const PLANET_EDGE_MARGIN = 90;

export const ZOOM_MAX = 2.0;

export const COLORS = {
  player: 0x4a90e2,
  enemy: 0xe25c4a,
  neutral: 0x888888,
  worldBg: 0x0f0f1e,
  worldBorder: 0x2a2a4a,
  spaceBg: 0x0a0a14,
} as const;

export const STARTING_UNITS = {
  player: 10,
  enemy: 10,
  neutralMin: 3,
  neutralMax: 7,
} as const;

export const UNIT_GEN_INTERVAL_MS = 2000;
export const UNIT_GEN_BASE = 1;
export const MAX_UNITS = 99;

export const FLEET_SPEED = 300;
export const FLEET_SEND_RATIO = 0.5;
export const FLEET_MIN_UNITS = 1;
export const FLEET_RADIUS = 10;

export const TAP_MOVE_THRESHOLD = 14;

export const ENEMY_AI_INTERVAL_MS = 2800;
export const ENEMY_AI_MIN_UNITS = 12;
