// src/utils/aiLocation.ts

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  motion: boolean;
}

/* ---------- GEO UTILS ---------- */
const toRad = (v: number) => (v * Math.PI) / 180;

/**
 * 計算兩個 GPS 點距離（公尺）
 */
export function calcDistance(a: LocationPoint, b: LocationPoint): number {
  const R = 6371e3; // 地球半徑 公尺
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * 計算兩點方位角（角度）
 */
export function calcBearing(a: LocationPoint, b: LocationPoint): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.cos(toRad(b.longitude - a.longitude));

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/* ---------- CONFIDENCE RULES ---------- */
export function calculateConfidence(
  prev: LocationPoint | null,
  curr: LocationPoint
) {
  if (!prev) return { confidence: 100, distance: 0, bearing: 0 };

  const distance = calcDistance(prev, curr);
  const bearing = calcBearing(prev, curr);
  const deltaTime = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
  let confidence = 100;

  // Rule 1: 瞬間超大跳點
  if (distance > 100_000 && deltaTime < 600) confidence = 0;

  // Rule 2: motion=false 卻大位移
  if (!curr.motion && distance > 50) confidence -= 40;

  // Rule 3: 不合理瞬間速度（GPS 推導）
  const gpsSpeed = deltaTime > 0 ? distance / deltaTime : 0;
  if (gpsSpeed > 55) confidence -= 40; // >200km/h

  // Rule 4: 長時間未更新
  if (deltaTime > 1800 && distance > 1000) confidence -= 20;

  return {
    confidence: Math.max(0, Math.min(confidence, 100)),
    distance,
    bearing,
  };
}

/* ---------- FORMATTING UTIL ---------- */

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  } else {
    const kmPart = Math.floor(km);
    const mPart = Math.round((km - kmPart) * 1000);
    return `${kmPart} km ${mPart} m`;
  }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}