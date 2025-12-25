
import React, { useState } from 'react';
import { Smartphone, Tablet, RotateCw, X } from 'lucide-react';

interface DeviceSimulatorProps {
    children: React.ReactNode;
    onClose: () => void;
    initialType?: 'mobile' | 'tablet';
    label: string;
}

const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ children, onClose, initialType = 'mobile', label }) => {
    const [device, setDevice] = useState<'mobile' | 'tablet'>(initialType);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

    // Dimensions for common devices
    const getStyles = () => {
        if (device === 'mobile') {
            return orientation === 'portrait' 
                ? { width: '375px', height: '812px' } 
                : { width: '812px', height: '375px' };
        } else {
            return orientation === 'portrait'
                ? { width: '768px', height: '1024px' }
                : { width: '1024px', height: '768px' };
        }
    };

    return (
        <div className="fixed inset-0 z-[6000] bg-slate-950 flex flex-col items-center justify-center p-4">
            {/* Simulator Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800 shadow-xl z-50">
                <div className="flex items-center gap-6">
                    <div>
                        <span className="text-white font-black uppercase tracking-widest text-sm block">APP PREVIEW</span>
                        <span className="text-[10px] font-bold text-[#00adef] uppercase tracking-wide">{label}</span>
                    </div>
                    
                    <div className="h-8 w-px bg-slate-800" />

                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button 
                            onClick={() => setDevice('mobile')} 
                            className={`px-3 py-2 rounded flex gap-2 items-center transition-all ${device === 'mobile' ? 'bg-[#00adef] text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Smartphone className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Mobile</span>
                        </button>
                        <button 
                            onClick={() => setDevice('tablet')} 
                            className={`px-3 py-2 rounded flex gap-2 items-center transition-all ${device === 'tablet' ? 'bg-[#00adef] text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Tablet className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Tablet</span>
                        </button>
                    </div>

                    <button 
                        onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')} 
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white flex gap-2 items-center hover:bg-slate-700 transition-colors"
                    >
                        <RotateCw className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">{orientation}</span>
                    </button>
                </div>

                <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded-lg font-black uppercase text-xs hover:bg-red-700 flex items-center gap-2 shadow-lg hover:scale-105 transition-all">
                    <X className="w-4 h-4" /> Exit Preview
                </button>
            </div>
            
            {/* Device Frame */}
            <div className="flex-1 w-full flex items-center justify-center overflow-auto py-20">
                <div 
                    className="relative bg-white dark:bg-slate-900 shadow-2xl transition-all duration-500 ease-in-out border-[12px] border-[#1a1a1a] rounded-[2.5rem] ring-1 ring-white/10"
                    style={getStyles()}
                >
                    {/* Screen Content */}
                    {/* transform: translateZ(0) makes this a containing block for fixed children */}
                    <div className="w-full h-full relative overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                        {children}
                    </div>

                    {/* Fake Home Bar */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full pointer-events-none" />
                </div>
            </div>
        </div>
    );
};

export default DeviceSimulator;
