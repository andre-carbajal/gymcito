'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Keypoint } from '@/src/lib/types';

// ── Helpers ───────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothKeypoint(prev: Keypoint, next: Keypoint, t: number): Keypoint {
  return {
    name: next.name,
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    score: next.score,
  };
}

// ── Hook ──────────────────────────────────────────────────────────
export function usePoseDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevKeypointsRef = useRef<Keypoint[]>([]);
  const rafIdRef = useRef<number>(0);
  const detectorRef = useRef<import('@tensorflow-models/pose-detection').PoseDetector | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Dynamic imports to keep bundle size manageable and avoid SSR issues
        const tf = await import('@tensorflow/tfjs-core');
        await import('@tensorflow/tfjs-backend-webgl');
        await tf.ready();

        const poseDetection = await import('@tensorflow-models/pose-detection');

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          },
        );

        if (cancelled) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector;
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize pose detection');
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!isReady || !detectorRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    let running = true;
    // Eliminado el delay: smoothingFactor 1.0 asegura que el punto se mueva al 100% de velocidad real (instantáneo)
    const smoothingFactor = 1.0;

    async function detect() {
      if (!running || !detectorRef.current || !video) return;

      try {
        if (video.readyState >= 2) {
          const poses = await detectorRef.current.estimatePoses(video);

          if (poses.length > 0 && poses[0].keypoints) {
            const raw: Keypoint[] = poses[0].keypoints.map((kp) => ({
              name: kp.name ?? '',
              x: kp.x,
              y: kp.y,
              score: kp.score ?? 0,
            }));

            const prev = prevKeypointsRef.current;
            const smoothed =
              prev.length === raw.length
                ? raw.map((kp, i) => smoothKeypoint(prev[i], kp, smoothingFactor))
                : raw;

            prevKeypointsRef.current = smoothed;
            setKeypoints(smoothed);
          }
        }
      } catch {
        // silently skip frame on error
      }

      if (running) {
        rafIdRef.current = requestAnimationFrame(detect);
      }
    }

    rafIdRef.current = requestAnimationFrame(detect);

    return () => {
      running = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [isReady, videoRef]);

  // Utility to get a specific keypoint by name
  const getPoint = useCallback(
    (name: string): Keypoint | undefined => {
      return keypoints.find((kp) => kp.name === name);
    },
    [keypoints],
  );

  return { keypoints, isReady, error, getPoint };
}
