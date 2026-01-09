'use client';

import Link from 'next/link';

interface Lab {
  lab_id: number;
  lab_name: string;
  lab_description: string;
  lab_tags: string[];
  level: number;
  max_score: number;
  created_at: string;
  updated_at: string;
}

interface ChallengeCardProps {
  lab: Lab;
}

export function ChallengeCard({ lab }: ChallengeCardProps) {

  const getDifficultyInfo = (level: number) => {
    if (level <= 2) {
      return { label: 'Easy', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
    } else if (level <= 4) {
      return { label: 'Medium', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    } else {
      return { label: 'Hard', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    }
  };

  const difficulty = getDifficultyInfo(lab.level);

  // Truncate description if too long
  const truncatedDescription = lab.lab_description && lab.lab_description.length > 120
    ? lab.lab_description.substring(0, 120) + '...'
    : lab.lab_description || 'No description available';

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-red-500/50 transition-all duration-300 group shadow-lg hover:shadow-2xl hover:shadow-red-500/10 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${difficulty.color} backdrop-blur-sm`}>
          {difficulty.label}
        </span>
        <span className="text-gray-500 text-xs">Level {lab.level}</span>
      </div>

      <h3 className="text-white text-xl font-bold mb-3 group-hover:text-red-400 transition-colors">
        {lab.lab_name}
      </h3>

      <p className="text-gray-400 text-sm mb-5 leading-relaxed min-h-[60px]">
        {truncatedDescription}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold text-lg">{lab.max_score}</span>
          <span className="text-gray-500 text-sm">points</span>
        </div>

        <Link href={`/challenge/${lab.lab_id}`}>
          <button 
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
          >
            Start Challenge
          </button>
        </Link>
      </div>
    </div>
  );
}