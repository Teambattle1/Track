import React, { useState, useRef, useEffect } from 'react';
import { Ruler, X } from 'lucide-react';

interface MeasureBoxProps {
    taskCount: number;
    distance: number;
    onClose: () => void;
}

const STORAGE_KEY = 'measurebox-position';

const MeasureBox: React.FC<MeasureBoxProps> = ({ taskCount, distance, onClose }) => {
    // Load saved position from localStorage or default to bottom-left
    const getInitialPosition = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // If parsing fails, use default
            }
        }
        // Default position: bottom-left of screen
        return {
            x: 20,
            y: window.innerHeight - 280 // 280px is approximate height of measure box
        };
    };

    const [position, setPosition] = useState(getInitialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking close button
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        // Save position to localStorage when drag ends
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    };

    React.useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, position]); // Add position to dependencies

    // Calculate time estimation
    const distanceKm = distance / 1000;
    const walkingSpeedKmPerHour = 3;
    const timePerTaskMinutes = 1;
    const walkingTimeMinutes = (distanceKm / walkingSpeedKmPerHour) * 60;
    const taskTimeMinutes = taskCount * timePerTaskMinutes;
    const totalTimeMinutes = walkingTimeMinutes + taskTimeMinutes;
    const hours = Math.floor(totalTimeMinutes / 60);
    const minutes = Math.round(totalTimeMinutes % 60);
    const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return (
        <div
            className={`fixed z-[3000] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: isDragging ? 'none' : 'auto'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="bg-orange-600 text-white rounded-lg shadow-2xl border-2 border-orange-400 animate-in fade-in slide-in-from-top min-w-[180px]">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-orange-500">
                    <div className="flex items-center gap-2">
                        <Ruler className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">Measure</span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="p-1 hover:bg-orange-700 rounded transition-colors"
                        title="Close measure mode"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="text-center">
                            <p className="text-[9px] text-orange-100 font-bold uppercase">Tasks</p>
                            <p className="text-xl font-black">{taskCount}</p>
                        </div>
                        <div className="w-px h-8 bg-orange-400"></div>
                        <div className="text-center">
                            <p className="text-[9px] text-orange-100 font-bold uppercase">Distance</p>
                            <p className="text-lg font-black">{Math.round(distance)}m</p>
                        </div>
                    </div>
                    
                    {taskCount > 0 && (
                        <div className="border-t border-orange-500 pt-2">
                            <p className="text-[8px] text-orange-100 font-bold uppercase tracking-wider mb-1 text-center">Est. Time</p>
                            <p className="text-base font-black text-center">{timeString}</p>
                            <p className="text-[7px] text-orange-100 text-center mt-1">3km/h + 1min/task</p>
                        </div>
                    )}
                </div>

                {/* Drag hint */}
                <div className="px-3 py-1 bg-orange-700 text-[7px] text-orange-200 text-center font-bold uppercase tracking-wider">
                    Drag to move
                </div>
            </div>
        </div>
    );
};

export default MeasureBox;
