'use client';

interface HandCursorProps {
  x: number;
  y: number;
  confirmProgress: number; // 0 a 1
}

export function HandCursor({ x, y, confirmProgress }: HandCursorProps) {
  const circumference = 2 * Math.PI * 28;

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64">
        {/* Fondo semitransparente */}
        <circle cx="32" cy="32" r="20" fill="rgba(0,255,136,0.1)" />
        {/* Anillo de progreso */}
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="#00ff88"
          strokeWidth="3"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${circumference * (1 - confirmProgress)}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
        {/* Punto central */}
        <circle cx="32" cy="32" r="4" fill="white" />
      </svg>
      {confirmProgress > 0.1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-green-400 text-xs whitespace-nowrap font-bold">
          {Math.round(confirmProgress * 100)}%
        </div>
      )}
    </div>
  );
}
