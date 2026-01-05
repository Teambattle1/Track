import React, { useState, useEffect } from 'react';
import './WalkingExplorerStyles.css';

interface Position {
    x: number;
    y: number;
}

type ExplorerAction = 'walking' | 'digging' | 'pointing' | 'monocular' | 'shooting' | 'celebrating';
type Direction = 'right' | 'left';

const WalkingExplorer: React.FC = () => {
    const [position, setPosition] = useState<Position>({ x: -10, y: 70 });
    const [isMoving, setIsMoving] = useState(true);
    const [direction, setDirection] = useState<Direction>('right');
    const [action, setAction] = useState<ExplorerAction>('walking');
    const [currentPath, setCurrentPath] = useState(0);
    const [hasSeenExplorer, setHasSeenExplorer] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);
    const [paths, setPaths] = useState<Array<{ start: Position; end: Position; direction: Direction; action: ExplorerAction }>>([]);

    // Check if user has seen explorer before
    useEffect(() => {
        const seen = sessionStorage.getItem('explorerSeen');
        if (!seen) {
            setShouldShow(true);
            
            // Generate random journey
            const startSide = Math.random() > 0.5 ? 'left' : 'right';
            const startY = 50 + Math.random() * 30; // Between 50-80% from top
            const actions: ExplorerAction[] = ['digging', 'pointing', 'monocular', 'shooting', 'celebrating'];
            
            // Create 3-5 random waypoints
            const numWaypoints = 3 + Math.floor(Math.random() * 3);
            const generatedPaths = [];
            
            if (startSide === 'left') {
                // Start from left, move right
                let currentX = -10;
                const endX = 110;
                const xStep = (endX - currentX) / numWaypoints;
                
                for (let i = 0; i < numWaypoints; i++) {
                    const nextX = currentX + xStep;
                    const nextY = startY + (Math.random() - 0.5) * 10; // Vary Y position
                    const pauseAction = actions[Math.floor(Math.random() * actions.length)];
                    
                    generatedPaths.push({
                        start: { x: currentX, y: startY + (i > 0 ? (Math.random() - 0.5) * 5 : 0) },
                        end: { x: nextX, y: nextY },
                        direction: 'right' as Direction,
                        action: pauseAction
                    });
                    
                    currentX = nextX;
                }
            } else {
                // Start from right, move left
                let currentX = 110;
                const endX = -10;
                const xStep = (endX - currentX) / numWaypoints;
                
                for (let i = 0; i < numWaypoints; i++) {
                    const nextX = currentX + xStep;
                    const nextY = startY + (Math.random() - 0.5) * 10;
                    const pauseAction = actions[Math.floor(Math.random() * actions.length)];
                    
                    generatedPaths.push({
                        start: { x: currentX, y: startY + (i > 0 ? (Math.random() - 0.5) * 5 : 0) },
                        end: { x: nextX, y: nextY },
                        direction: 'left' as Direction,
                        action: pauseAction
                    });
                    
                    currentX = nextX;
                }
            }
            
            setPaths(generatedPaths);
            setDirection(startSide === 'left' ? 'right' : 'left');
            setPosition(generatedPaths[0].start);
        } else {
            setHasSeenExplorer(true);
        }
    }, []);

    useEffect(() => {
        if (!shouldShow || hasSeenExplorer || paths.length === 0) return;

        let animationFrame: number;
        let lastTime = Date.now();
        let pauseTimeout: NodeJS.Timeout;

        const animate = () => {
            const now = Date.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            if (isMoving) {
                const path = paths[currentPath];
                const speed = 10; // pixels per second

                setPosition(prev => {
                    let newX = prev.x;
                    let newY = prev.y;

                    if (direction === 'right') {
                        newX = prev.x + speed * delta;
                        const progress = (newX - path.start.x) / (path.end.x - path.start.x);
                        newY = path.start.y + (path.end.y - path.start.y) * progress;

                        if (newX >= path.end.x) {
                            setIsMoving(false);
                            setAction(path.action);
                            
                            pauseTimeout = setTimeout(() => {
                                const nextPath = currentPath + 1;

                                if (nextPath >= paths.length) {
                                    sessionStorage.setItem('explorerSeen', 'true');
                                    setHasSeenExplorer(true);
                                    return;
                                }

                                setCurrentPath(nextPath);
                                setAction('walking');
                                setIsMoving(true);
                            }, 2500 + Math.random() * 2000);

                            return { x: path.end.x, y: path.end.y };
                        }
                    } else {
                        newX = prev.x - speed * delta;
                        const progress = (path.start.x - newX) / (path.start.x - path.end.x);
                        newY = path.start.y + (path.end.y - path.start.y) * progress;

                        if (newX <= path.end.x) {
                            setIsMoving(false);
                            setAction(path.action);
                            
                            pauseTimeout = setTimeout(() => {
                                const nextPath = currentPath + 1;

                                if (nextPath >= paths.length) {
                                    sessionStorage.setItem('explorerSeen', 'true');
                                    setHasSeenExplorer(true);
                                    return;
                                }

                                setCurrentPath(nextPath);
                                setAction('walking');
                                setIsMoving(true);
                            }, 2500 + Math.random() * 2000);

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
    }, [isMoving, direction, currentPath, shouldShow, hasSeenExplorer, paths]);

    if (hasSeenExplorer || !shouldShow || paths.length === 0) {
        return null;
    }

    return (
        <div
            className="explorer-container"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
            }}
        >
            <div className={`explorer ${action} ${direction}`}>
                <ExplorerCharacter action={action} direction={direction} />
                
                {/* Visual effects */}
                {isMoving && action === 'walking' && (
                    <div className="dust-cloud"></div>
                )}
                
                {!isMoving && action === 'digging' && (
                    <div className="dig-effect">
                        <div className="dirt-particle"></div>
                        <div className="dirt-particle"></div>
                        <div className="dirt-particle"></div>
                    </div>
                )}
                
                {!isMoving && action === 'shooting' && (
                    <div className="muzzle-flash"></div>
                )}
                
                {!isMoving && action === 'celebrating' && (
                    <div className="celebration-stars">⭐✨🎉</div>
                )}
            </div>
        </div>
    );
};

// Explorer character component with different poses
const ExplorerCharacter: React.FC<{ action: ExplorerAction; direction: Direction }> = ({ action, direction }) => {
    return (
        <svg 
            width="60" 
            height="80" 
            viewBox="0 0 60 80" 
            className="explorer-svg"
        >
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
            
            {/* Face expressions change based on action */}
            {action === 'celebrating' ? (
                <>
                    <circle cx="27" cy="14" r="2" fill="#000" className="eye" />
                    <circle cx="33" cy="14" r="2" fill="#000" className="eye" />
                    <path d="M 26 18 Q 30 21 34 18" stroke="#000" strokeWidth="1.5" fill="none" className="smile-big" />
                </>
            ) : action === 'monocular' ? (
                <>
                    <circle cx="27" cy="14" r="1.5" fill="#000" className="eye" />
                    <circle cx="33" cy="14" r="3" fill="#333" stroke="#000" strokeWidth="1" className="monocular-lens" />
                    <path d="M 27 18 L 33 18" stroke="#000" strokeWidth="1.5" className="mouth" />
                </>
            ) : (
                <>
                    <circle cx="27" cy="14" r="1.5" fill="#000" className="eye" />
                    <circle cx="33" cy="14" r="1.5" fill="#000" className="eye" />
                    <path d="M 26 18 Q 30 20 34 18" stroke="#000" strokeWidth="1.5" fill="none" className="smile" />
                </>
            )}

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
            
            {/* Arms - different poses */}
            {action === 'pointing' && (
                <g className="arms pointing">
                    <line x1="22" y1="28" x2="18" y2="35" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="28" x2="50" y2="25" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="pointing-arm" />
                </g>
            )}
            {action === 'digging' && (
                <g className="arms digging">
                    <line x1="22" y1="28" x2="25" y2="40" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="28" x2="35" y2="40" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <rect x="28" y="40" width="4" height="15" fill="#8b4513" className="shovel" />
                </g>
            )}
            {action === 'monocular' && (
                <g className="arms monocular">
                    <line x1="22" y1="28" x2="18" y2="32" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="28" x2="32" y2="15" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                </g>
            )}
            {action === 'shooting' && (
                <g className="arms shooting">
                    <line x1="22" y1="28" x2="20" y2="30" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="28" x2="45" y2="28" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" />
                    <rect x="40" y="26" width="12" height="4" fill="#654321" rx="1" className="rifle" />
                </g>
            )}
            {action === 'celebrating' && (
                <g className="arms celebrating">
                    <line x1="22" y1="28" x2="15" y2="20" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-celebrate-left" />
                    <line x1="38" y1="28" x2="45" y2="20" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-celebrate-right" />
                </g>
            )}
            {action === 'walking' && (
                <g className="arms walking">
                    <line x1="22" y1="28" x2="18" y2="35" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-walk-left" />
                    <line x1="38" y1="28" x2="35" y2="32" stroke="#fdb777" strokeWidth="3" strokeLinecap="round" className="arm-walk-right" />
                </g>
            )}

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
    );
};

export default WalkingExplorer;
