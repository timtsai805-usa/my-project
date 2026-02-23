// src/utils/Location.ts

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  motion: boolean;
  method?: 'gps' | 'wifi';
  accuracy?: number; // meters
}

/* ---------- GEO UTILS ---------- */
const toRad = (v: number) => (v * Math.PI) / 180;

/** 計算兩個 GPS 點距離（公尺） */
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

/** 計算方位角 */
export function calcBearing(a: LocationPoint, b: LocationPoint): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.cos(toRad(b.longitude - a.longitude));

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/* ---------- CONFIDENCE & RULES ---------- */
export function calculateConfidence(
  prev: LocationPoint | null,
  curr: LocationPoint
) {
  if (!prev) return { confidence: 100, distance: 0, bearing: 0 };

  const distance = calcDistance(prev, curr);
  const bearing = calcBearing(prev, curr);
  const deltaTime = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
  let confidence = 100;

  if (distance > 100_000 && deltaTime < 600) confidence = 0;
  if (!curr.motion && distance > 50) confidence -= 40;
  const gpsSpeed = deltaTime > 0 ? distance / deltaTime : 0;
  if (gpsSpeed > 55) confidence -= 40; // >200km/h
  if (deltaTime > 1800 && distance > 1000) confidence -= 20;

  return {
    confidence: Math.max(0, Math.min(confidence, 100)),
    distance,
    bearing,
  };
}

/* ---------- STATISTICS ---------- */
export function calcAvgAccuracy(points: LocationPoint[]): number {
  const valid = points.filter(p => p.accuracy != null).map(p => p.accuracy!);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function getMotionStatus(points: LocationPoint[]): string {
  const trueCount = points.filter(p => p.motion).length;
  const falseCount = points.length - trueCount;

  if (trueCount > falseCount) return 'Very active';
  if (trueCount === falseCount) return 'Normal';
  return 'Need to move around';
}

export function getAccuracyLevel(accuracy?: number): string {
  if (accuracy == null) return 'Unknown';
  if (accuracy < 20) return 'High';
  if (accuracy < 50) return 'Medium';
  return 'Low';
}

export function checkAnomalies(points: LocationPoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const { distance } = calculateConfidence(points[i - 1], points[i]);
    if (distance > 50 && !points[i].motion) return true;
  }
  return false;
}

/* ---------- FORMATTING ---------- */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const kmPart = Math.floor(km);
  const mPart = Math.round((km - kmPart) * 1000);
  return `${kmPart} km ${mPart} m`;
}

export function formatDurationSec(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

/* ---------- TIMELINE ---------- */
export function generateTimeline(points: LocationPoint[]): string[] {
  const timeline: string[] = [];
  let prev: LocationPoint | null = null;

  for (const p of points) {
    const timeStr = p.timestamp.toISOString().slice(11, 16); // HH:MM
    if (!prev) {
      timeline.push(`- ${timeStr} 開始${p.motion ? '移動' : '靜止'}`);
    } else {
      const distanceM = Math.round(calcDistance(prev, p));
      const durationSec = Math.round((p.timestamp.getTime() - prev.timestamp.getTime()) / 1000);

      if (p.motion && !prev.motion) {
        timeline.push(`- ${timeStr} 再次移動`);
      } else if (!p.motion && prev.motion) {
        timeline.push(`- ${timeStr} 停留休息，持續 ${formatDurationSec(durationSec)}`);
      } else if (p.motion && prev.motion && distanceM >= 1) {
        timeline.push(`- ${timeStr} 到達位置，移動距離 ${distanceM} 公尺`);
      }
    }
    prev = p;
  }

  return timeline;
}