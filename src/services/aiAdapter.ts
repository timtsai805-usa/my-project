// src/services/aiAdapter.ts
import OpenAI from 'openai';
import { LocationPoint, calcAvgAccuracy, getMotionStatus, getAccuracyLevel, formatDistanceKm, formatDurationSec, calculateConfidence, calcDistance } from '../utils/Location';

export interface AiResult {
  totalPoints: number;
  totalDistance: string;
  totalTime: string;
  lastLocation: {
    lat: number;
    lng: number;
    motion: boolean;
    method?: string;
    accuracyLevel?: string;
  };
  lastConfidence: number;
  anomalies: boolean;
  avgAccuracy: number;
  motionStatus: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const aiAdapter = async (trackDetails: LocationPoint[]): Promise<AiResult> => {
  if (!trackDetails.length) throw new Error("No track details provided to AI");

  const totalPoints = trackDetails.length;

  // 計算總距離和總時間
  let totalDistanceKm = 0;
  let totalTimeSec = 0;
  let prev: LocationPoint | null = null;
  for (const t of trackDetails) {
    if (prev) {
      const distance = calcDistance(prev, t) / 1000;
      const duration = (t.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      totalDistanceKm += distance;
      totalTimeSec += duration;
    }
    prev = t;
  }

  const lastPoint = trackDetails[trackDetails.length - 1];
  const lastConfidence = trackDetails.length >= 2
    ? calculateConfidence(trackDetails[trackDetails.length - 2], lastPoint).confidence
    : 100;

  const avgAccuracy = Math.round(calcAvgAccuracy(trackDetails));
  const motionStatus = getMotionStatus(trackDetails);
  const anomalies = lastConfidence < 70;
  const accuracyLevel = getAccuracyLevel(lastPoint.accuracy);

  const aiResult: AiResult = {
    totalPoints,
    totalDistance: formatDistanceKm(totalDistanceKm),
    totalTime: formatDurationSec(totalTimeSec),
    lastLocation: {
      lat: lastPoint.latitude,
      lng: lastPoint.longitude,
      motion: lastPoint.motion,
      method: lastPoint.method,
      accuracyLevel,
    },
    lastConfidence,
    anomalies,
    avgAccuracy,
    motionStatus,
  };

  return aiResult;
};