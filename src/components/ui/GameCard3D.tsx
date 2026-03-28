'use client';

interface GameCard3DProps {
  title: string;
  description: string;
  emoji: string;
  slug: string;
  position: 'left' | 'center' | 'right';
  confirmProgress: number;
  onClick: () => void;
}

const POSITION_STYLES = {
  left: {
    transform: 'translateX(-280px) translateZ(-150px) rotateY(35deg)',
    opacity: 0.5,
    scale: '0.85',
    zIndex: 0,
  },
  center: {
    transform: 'translateX(0px) translateZ(0px) rotateY(0deg)',
    opacity: 1,
    scale: '1',
    zIndex: 10,
  },
  right: {
    transform: 'translateX(280px) translateZ(-150px) rotateY(-35deg)',
    opacity: 0.5,
    scale: '0.85',
    zIndex: 0,
  },
};

export function GameCard3D({
  title,
  description,
  emoji,
  position,
  confirmProgress,
  onClick,
}: GameCard3DProps) {
  const styles = POSITION_STYLES[position];
  const isCenter = position === 'center';

  return (
    <div
      onClick={onClick}
      className="absolute cursor-pointer transition-all duration-500"
      style={{
        width: 300,
        height: 220,
        transform: styles.transform,
        opacity: styles.opacity,
        scale: styles.scale,
        zIndex: styles.zIndex,
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className={`w-full h-full rounded-2xl p-6 flex flex-col justify-between
        ${
          isCenter
            ? 'bg-gray-900 border-2 border-green-400 shadow-2xl shadow-green-400/30'
            : 'bg-gray-900/80 border border-gray-700'
        }`}
      >
        <div>
          <span className="text-5xl">{emoji}</span>
          <h2 className="text-xl font-bold mt-2 text-white font-mono">{title}</h2>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>

        {/* Barra de progreso solo en card central */}
        {isCenter && (
          <div className="w-full">
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-100"
                style={{ width: `${confirmProgress * 100}%` }}
              />
            </div>
            <p className="text-xs text-green-400 mt-1 text-center">
              {confirmProgress > 0 ? 'Manteniendo...' : '✋ Mantén la mano aquí'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
