'use client';

interface GameCardProps {
  title: string;
  description: string;
  emoji: string;
  slug: string;
  onClick: () => void;
}

export function GameCard({ title, description, emoji, onClick }: GameCardProps) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer w-72 h-52 bg-gray-900 border border-gray-700
        rounded-2xl p-6 flex flex-col justify-between
        hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/20
        hover:scale-105 transition-all duration-300"
    >
      <div>
        <span className="text-5xl">{emoji}</span>
        <h2 className="text-xl font-bold mt-3 text-white font-mono">{title}</h2>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <button className="w-full py-2 bg-purple-600 hover:bg-purple-500
        rounded-xl text-white font-bold transition-colors cursor-pointer">
        ▶ JUGAR
      </button>
    </div>
  );
}
