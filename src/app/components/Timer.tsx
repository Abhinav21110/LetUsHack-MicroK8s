"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  startTime: string; // ISO timestamp when container/lab started
  durationMinutes?: number; // Default 60 minutes
  onExpire?: () => void; // Callback when timer expires
  variant?: "lab" | "os"; // Visual variant
}

export default function Timer({ 
  startTime, 
  durationMinutes = 60, 
  onExpire,
  variant = "lab" 
}: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = now - start;
      const duration = durationMinutes * 60 * 1000; // Convert to milliseconds
      const remaining = Math.max(0, duration - elapsed);

      if (remaining === 0 && !isExpired) {
        setIsExpired(true);
        if (onExpire) {
          onExpire();
        }
      }

      return remaining;
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, durationMinutes, onExpire, isExpired]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getColorClass = (): string => {
    const percentRemaining = (timeRemaining / (durationMinutes * 60 * 1000)) * 100;
    
    if (isExpired) return "text-red-500 border-red-500/30 bg-red-500/10";
    if (percentRemaining <= 10) return "text-red-400 border-red-400/30 bg-red-400/10";
    if (percentRemaining <= 25) return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    if (variant === "os") return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    return "text-green-400 border-green-400/30 bg-green-400/10";
  };

  const getLabel = (): string => {
    if (isExpired) return "TIME EXPIRED";
    return variant === "os" ? "OS Time Left" : "Lab Time Left";
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getColorClass()} transition-colors`}>
      <Clock className="w-4 h-4" />
      <div className="flex flex-col">
        <span className="text-xs opacity-80">{getLabel()}</span>
        <span className="text-sm font-mono font-bold">
          {isExpired ? "0:00" : formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
}
