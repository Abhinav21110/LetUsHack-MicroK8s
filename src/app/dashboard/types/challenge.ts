export type Category = 'All' | 'Web' | 'Crypto' | 'Forensics' | 'Reverse Engineering' | 'Binary Exploitation';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: Category;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  solved?: boolean;
  attempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  points: number;
  rank: number;
  completedChallenges: string[];
  createdAt: Date;
  updatedAt: Date;
}