import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, CameraOff, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);

    // Start camera stream
    const startCamera = async () => {
        setIsLoading(true);
        setError(null);

        // Stop existing stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();

                // Start scanning
                scanIntervalRef.current = window.setInterval(() => {
                    if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                        const canvas = canvasRef.current;
                        const ctx = canvas.getContext('2d');

                        if (ctx) {
                            canvas.width = videoRef.current.videoWidth;
                            canvas.height = videoRef.current.videoHeight;
                            ctx.drawImage(videoRef.current, 0, 0);

                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const code = jsQR(imageData.data, imageData.width, imageData.height);

                            if (code) {
                                setScannedData(code.data);
                                onScan(code.data);
                                handleClose();
                            }
                        }
                    }
                }, 100);

                setIsLoading(false);
            }
        } catch (err: any) {
            console.error('Camera access failed:', err);
            setError(err.message || 'Failed to access camera');
            setIsLoading(false);
        }
    };

    // Toggle camera
    const toggleCamera = () => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    // Close handler
    const handleClose = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
        }
        onClose();
    };

    // Start camera when modal opens or facing mode changes
    useEffect(() => {
        if (isOpen) {
            startCamera();
        }
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
            }
        };
    }, [isOpen, facingMode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-orange-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Camera className="w-6 h-6" />
                        QR Code Scanner
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Camera View */}
                <div className="relative aspect-video bg-black">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 text-orange-400 animate-spin mx-auto mb-2" />
                                <p className="text-white text-sm">Starting camera...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="text-center max-w-md mx-4">
                                <CameraOff className="w-12 h-12 text-red-400 mx-auto mb-2" />
                                <p className="text-white text-sm mb-2">Camera Error</p>
                                <p className="text-gray-300 text-xs">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                    />

                    {/* Scanning overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 border-4 border-orange-400/30" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-orange-400 rounded-lg shadow-lg">
                            {/* Corner markers */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
                        </div>
                    </div>

                    {/* Hidden canvas for QR processing */}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Controls */}
                <div className="p-4 bg-orange-800/50">
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={toggleCamera}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-lg"
                        >
                            <Camera className="w-5 h-5" />
                            Switch to {facingMode === 'environment' ? 'Front' : 'Rear'} Camera
                        </button>
                    </div>
                    <p className="text-center text-white/70 text-sm mt-3">
                        Position the QR code within the frame to scan
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;
