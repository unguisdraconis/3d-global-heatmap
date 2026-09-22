export const GRID = Object.freeze({ width: 1440, height: 720, resolution: 0.25 });
export const TEMP = Object.freeze({ min: -80, max: 60, scale: 0.01, offset: -100, missing: 65535 });

export function decodeTemperature(value) {
  return value >= 65534 ? null : value * TEMP.scale + TEMP.offset;
}

export function uvToCell(uv) {
  const column = Math.min(GRID.width - 1, Math.max(0, Math.floor(uv.x * GRID.width)));
  const row = Math.min(GRID.height - 1, Math.max(0, Math.floor((1 - uv.y) * GRID.height)));
  return { row, column, index: row * GRID.width + column };
}

export function cellToCoordinates(row, column) {
  return {
    latitude: 89.875 - row * GRID.resolution,
    longitude: -179.875 + column * GRID.resolution,
  };
}

export function formatCoordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export function formatDateRange(start, end) {
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${end}T12:00:00Z`);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  if (a.getUTCMonth() === b.getUTCMonth()) return `${month.format(a)} ${a.getUTCDate()}–${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  return `${month.format(a)} ${a.getUTCDate()} – ${month.format(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
}
