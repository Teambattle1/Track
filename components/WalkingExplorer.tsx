import React, { useState, useEffect } from 'react';
import './WalkingExplorerStyles.css';

interface Position {
    x: number;
    y: number;
}

const WalkingExplorer: React.FC = () => {
    const [position, setPosition] = useState<Position>({ x: -10, y: 70 });
    const [isWalking, setIsWalking] = useState(true);
    const [direction, setDirection] = useState<'right' | 'left'>('right');
    const [currentPath, setCurrentPath] = useState(0);
    const [hasSeenExplorer, setHasSeenExplorer] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);

    // Check if user has seen explorer before
    useEffect(() => {
        const seen = sessionStorage.getItem('explorerSeen');
        if (!seen) {
            setShouldShow(true);
        } else {
            setHasSeenExplorer(true);
        }
    }, []);

    // Define walking paths across the screen (one-time journey)
    const paths = [
        { start: { x: -10, y: 70 }, end: { x: 30, y: 65 }, direction: 'right' as const },
        { start: { x: 30, y: 65 }, end: { x: 50, y: 70 }, direction: 'right' as const },
        { start: { x: 50, y: 70 }, end: { x: 75, y: 68 }, direction: 'right' as const },
        { start: { x: 75, y: 68 }, end: { x: 110, y: 72 }, direction: 'right' as const },
    ];

    useEffect(() => {
        let animationFrame: number;
        let lastTime = Date.now();
        let pauseTimeout: NodeJS.Timeout;

        const animate = () => {
            const now = Date.now();
            const delta = (now - lastTime) / 1000; // Convert to seconds
            lastTime = now;

            if (isWalking) {
                const path = paths[currentPath];
                const speed = 8; // pixels per second
                
                setPosition(prev => {
                    let newX = prev.x;
                    let newY = prev.y;

                    if (direction === 'right') {
                        newX = prev.x + speed * delta;
                        // Interpolate Y based on progress
                        const progress = (newX - path.start.x) / (path.end.x - path.start.x);
                        newY = path.start.y + (path.end.y - path.start.y) * progress;

                        // Check if reached end of path
                        if (newX >= path.end.x) {
                            // Stop and search the map
                            setIsWalking(false);
                            pauseTimeout = setTimeout(() => {
                                // Move to next path or loop
                                const nextPath = (currentPath + 1) % paths.length;
                                setCurrentPath(nextPath);
                                
                                // If looping back, reset position
                                if (nextPath === 0) {
                                    setPosition({ x: -10, y: 70 });
                                }
                                
                                setIsWalking(true);
                            }, 3000 + Math.random() * 2000); // Pause 3-5 seconds
                            
                            return { x: path.end.x, y: path.end.y };
                        }
                    }

                    return { x: newX, y: newY };
                });
            }

            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame);
            if (pauseTimeout) clearTimeout(pauseTimeout);
        };
    }, [isWalking, direction, currentPath]);

    return (
        <div 
            className="explorer-container"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
            }}
        >
            <div className={`explorer ${isWalking ? 'walking' : 'searching'} ${direction}`}>
                {/* Character SVG */}
                <svg 
                    width="60" 
                    height="80" 
                    viewBox="0 0 60 80" 
                    className="explorer-svg"
                >
                    {/* Map in hands */}
                    <g className="map-group">
                        <rect 
                            x="15" 
                            y="28" 
                            width="20" 
                            height="16" 
                            fill="#f4e4c1" 
                            stroke="#8b7355" 
                            strokeWidth="1"
                            rx="1"
                            className="map"
                        />
                        <line x1="18" y1="31" x2="32" y2="31" stroke="#8b7355" strokeWidth="0.5" opacity="0.6" />
                        <line x1="18" y1="34" x2="30" y2="34" stroke="#8b7355" strokeWidth="0.5" opacity="0.6" />
                        <line x1="18" y1="37" x2="32" y2="37" stroke="#8b7355" strokeWidth="0.5" opacity="0.6" />
                        <line x1="18" y1="40" x2="28" y2="40" stroke="#8b7355" strokeWidth="0.5" opacity="0.6" />
                        <circle cx="27" cy="35" r="2" fill="#d97757" opacity="0.7" className="map-marker" />
                    </g>

                    {/* Head */}
                    <circle 
                        cx="30" 
                        cy="15" 
                        r="8" 
                        fill="#fdb777" 
                        stroke="#000" 
                        strokeWidth="1.5"
                        className="head"
                    />
                    
                    {/* Happy face */}
                    <circle cx="27" cy="14" r="1.5" fill="#000" className="eye" />
                    <circle cx="33" cy="14" r="1.5" fill="#000" className="eye" />
                    <path d="M 26 18 Q 30 20 34 18" stroke="#000" strokeWidth="1.5" fill="none" className="smile" />

                    {/* Hat */}
                    <ellipse cx="30" cy="10" rx="9" ry="3" fill="#8b4513" className="hat-brim" />
                    <rect x="24" y="4" width="12" height="7" fill="#a0522d" rx="1" className="hat-top" />

                    {/* Body */}
                    <rect 
                        x="22" 
                        y="23" 
                        width="16" 
                        height="22" 
                        fill="#4a90e2" 
                        stroke="#000" 
                        strokeWidth="1.5"
                        rx="2"
                        className="body"
                    />
                    
                    {/* Arms holding map */}
                    <g className="arms">
                        <line x1="22" y1="28" x2="15" y2="35" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-left" />
                        <line x1="38" y1="28" x2="35" y2="35" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-right" />
                    </g>

                    {/* Legs */}
                    <g className="legs">
                        <line x1="26" y1="45" x2="24" y2="62" stroke="#8b4513" strokeWidth="3.5" strokeLinecap="round" className="leg-left" />
                        <line x1="34" y1="45" x2="36" y2="62" stroke="#8b4513" strokeWidth="3.5" strokeLinecap="round" className="leg-right" />
                    </g>

                    {/* Bare feet */}
                    <g className="feet">
                        <ellipse cx="23" cy="63" rx="4" ry="2.5" fill="#fdb777" stroke="#000" strokeWidth="1" className="foot-left" />
                        <ellipse cx="37" cy="63" rx="4" ry="2.5" fill="#fdb777" stroke="#000" strokeWidth="1" className="foot-right" />
                    </g>

                    {/* Backpack */}
                    <rect x="35" y="26" width="8" height="12" fill="#6b8e23" stroke="#000" strokeWidth="1" rx="2" className="backpack" />
                    <circle cx="39" cy="32" r="1.5" fill="#8b4513" />
                </svg>

                {/* Dust cloud when walking */}
                {isWalking && (
                    <div className="dust-cloud"></div>
                )}

                {/* Thought bubble when searching */}
                {!isWalking && (
                    <div className="thought-bubble">
                        <div className="bubble">🤔</div>
                        <div className="bubble-tail"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalkingExplorer;
