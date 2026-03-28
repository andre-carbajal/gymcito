'use client';

import { useEffect, useRef, useState } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) {
              setIsReady(true);
            }
          };
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            setError('Permiso de cámara denegado. Habilita la cámara en la configuración del navegador.');
          } else if (err instanceof DOMException && err.name === 'NotFoundError') {
            setError('No se encontró una cámara. Conecta una cámara e intenta de nuevo.');
          } else {
            setError('Error al acceder a la cámara.');
          }
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, isReady, error };
}
