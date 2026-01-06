import React, { useState, useEffect } from 'react';
import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ZoneChangeItemProps {
    id: string;
    index: number;
    title: string;
    enabled: boolean;
    hasTriggered: boolean;
    targetTime?: number;
    hasActiveZoneChanges: boolean;
    isGameEnded?: boolean;
    onClick: () => void;
}

const ZoneChangeItem: React.FC<ZoneChangeItemProps> = ({
    id,
    index,
    title,
    enabled,
    hasTriggered,
    targetTime,
    hasActiveZoneChanges,
    isGameEnded,
    onClick,
}) => {
    const [countdown, setCountdown] = useState('');
    const isActive = enabled && !hasTriggered;
    const hasTime = !!targetTime;

    useEffect(() => {
        // If no targetTime set, show "Not set"
        if (!targetTime) {
            setCountdown('NOT SET');
            return;
        }

        const updateCountdown = () => {
            const now = Date.now();
            const remaining = targetTime - now;

            // If time has passed
            if (remaining <= 0) {
                if (hasTriggered) {
                    setCountdown('TRIGGERED');
                } else {
                    setCountdown('00:00:00');
                }
                return;
            }

            // Calculate time remaining
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [targetTime, hasTriggered]);

    return (
        <button
            key={id}
            onClick={onClick}
            className={`w-full py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col gap-1 transition-all ${
                isActive
                    ? hasActiveZoneChanges
                        ? 'bg-yellow-700 hover:bg-yellow-800 text-white border-2 border-yellow-500'
                        : 'bg-orange-700 hover:bg-orange-800 text-white border-2 border-orange-500'
                    : 'bg-orange-800/50 text-orange-200 border-2 border-orange-700/50'
            }`}
            title={`Click to adjust zone change time: ${title}`}
        >
            <span className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black ${hasActiveZoneChanges ? 'bg-yellow-800' : 'bg-orange-800'}`}>
                        {index + 1}
                    </span>
                    <span className="truncate">{title}</span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {hasTime && !isGameEnded && (
                        <AlertTriangle className="w-3 h-3 animate-pulse" />
                    )}
                    {hasTime && isGameEnded && (
                        <AlertTriangle className="w-3 h-3" />
                    )}
                    <Clock className="w-3 h-3" />
                </span>
            </span>
            <span className="text-red-500 font-mono text-sm font-black tracking-wider">
                {countdown || 'NOT SET'}
            </span>
        </button>
    );
};

export default ZoneChangeItem;
