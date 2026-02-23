// src/types/express.d.ts
import * as express from 'express';
import { LocationPoint } from '../utils/Location';

declare global {
  namespace Express {
    interface Request {
      locationAnalysis?: {
        confidence: number;
        isReliable: boolean;
        curr: LocationPoint;
      };
    }
  }
}