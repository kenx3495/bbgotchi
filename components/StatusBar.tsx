
import React from 'react';

interface StatusBarProps {
  label: string;
  value: number;
  color: string;
  icon: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ label, value, color, icon }) => {
  return (
    <div className="w-full mb-3">
      <div className="flex justify-between items-center mb-1 text-sm font-bold text-gray-700">
        <span className="flex items-center gap-1">
          <span>{icon}</span> {label}
        </span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full transition-all duration-1000 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
};
