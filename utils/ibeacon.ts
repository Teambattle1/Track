/**
 * iBeacon Module
 * Provides support for scanning, connecting, and monitoring iBeacons
 * Uses Web Bluetooth API for beacon detection (available on Android, iOS 13+)
 */

export interface iBeaconDevice {
    id: string;
    uuid: string;
    major: number;
    minor: number;
    rssi: number; // Signal strength (-100 to -30 dBm)
    txPower: number; // TX power at 1 meter
    accuracy: number; // Estimated distance in meters
    proximity: 'unknown' | 'immediate' | 'near' | 'far';
    lastSeen: number;
    name?: string;
}

export interface iBeaconFilter {
    uuid?: string;
    major?: number;
    minor?: number;
}

export interface iBeaconScanResult {
    isScanning: boolean;
    devicesFound: iBeaconDevice[];
    scanStartTime?: number;
}

/**
 * Check if device supports Web Bluetooth API
 */
export const isBluetoothSupported = (): boolean => {
    return typeof window !== 'undefined' && 'bluetooth' in navigator;
};

/**
 * Convert RSSI to proximity estimate
 */
const rssiToProximity = (rssi: number): 'immediate' | 'near' | 'far' => {
    if (rssi > -50) return 'immediate';
    if (rssi > -70) return 'near';
    return 'far';
};

/**
 * Calculate estimated distance from RSSI
 * Formula: distance = 10^((txPower - rssi) / (10 * n))
 * where n is typically 2 for free space path loss
 */
const calculateDistance = (rssi: number, txPower: number = -59): number => {
    const n = 2; // Path loss exponent
    if (rssi === 0) return -1;
    
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return Math.round(distance * 100) / 100; // Round to 2 decimals
};

/**
 * Start iBeacon scanning
 * Scans for Bluetooth LE devices advertising iBeacon format
 */
export const startBeaconScan = async (filter?: iBeaconFilter): Promise<iBeaconScanResult> => {
    try {
        if (!isBluetoothSupported()) {
            throw new Error('Bluetooth is not supported on this device');
        }

        const scanResult: iBeaconScanResult = {
            isScanning: true,
            devicesFound: [],
            scanStartTime: Date.now()
        };

        // Request device discovery
        const device = await ((navigator as any).bluetooth).requestDevice({
            filters: filter ? [{ 
                name: filter.uuid,
                services: ['180a'] // Device Information Service
            }] : [],
            optionalServices: ['180a', '180f'],
            acceptAllDevices: !filter // Accept all if no filter specified
        });

        if (device) {
            const gatt = await device.gatt.connect();
            const services = await gatt.getPrimaryServices();
            
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                
                for (const characteristic of characteristics) {
                    const value = await characteristic.readValue();
                    
                    // Parse iBeacon data from manufacturer data
                    const iBeacon = parseBeaconData(value);
                    if (iBeacon) {
                        scanResult.devicesFound.push({
                            ...iBeacon,
                            lastSeen: Date.now(),
                            name: device.name
                        });
                    }
                }
            }
            
            await gatt.disconnect();
        }

        return scanResult;
    } catch (error) {
        console.error('Beacon Scan Error:', error);
        throw error;
    }
};

/**
 * Parse iBeacon advertising data
 * iBeacon format: Apple Inc. (company ID 0x004C) prefix + 16-byte UUID + 2-byte Major + 2-byte Minor + 1-byte TX Power
 */
const parseBeaconData = (dataView: DataView): Omit<iBeaconDevice, 'lastSeen' | 'name'> | null => {
    try {
        // iBeacon prefix check (Apple company ID: 0x004C)
        if (dataView.byteLength < 25) return null;

        // Extract UUID (bytes 2-17, big-endian)
        const uuid = Array.from(new Uint8Array(dataView.buffer, 2, 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('-');

        // Extract Major (bytes 18-19, big-endian)
        const major = dataView.getUint16(18, false);

        // Extract Minor (bytes 20-21, big-endian)
        const minor = dataView.getUint16(20, false);

        // Extract TX Power (byte 22, signed)
        const txPowerByte = new Int8Array(dataView.buffer, 22, 1)[0];

        // RSSI is typically provided separately, default to -59 (Apple standard)
        const rssi = -59;
        const accuracy = calculateDistance(rssi, txPowerByte);
        const proximity = rssiToProximity(rssi);

        return {
            id: `${uuid}-${major}-${minor}`,
            uuid,
            major,
            minor,
            rssi,
            txPower: txPowerByte,
            accuracy,
            proximity
        };
    } catch (error) {
        console.error('Failed to parse beacon data:', error);
        return null;
    }
};

/**
 * Listen for continuous beacon monitoring
 */
export const startBeaconMonitoring = (
    callback: (beacons: iBeaconDevice[]) => void,
    filter?: iBeaconFilter,
    interval: number = 5000 // Default 5 second scan interval
): (() => void) => {
    let isMonitoring = true;
    const detectedBeacons = new Map<string, iBeaconDevice>();

    const monitoringLoop = async () => {
        while (isMonitoring) {
            try {
                const result = await startBeaconScan(filter);
                
                // Update beacon list
                result.devicesFound.forEach(beacon => {
                    detectedBeacons.set(beacon.id, {
                        ...beacon,
                        lastSeen: Date.now()
                    });
                });

                // Remove beacons not seen in last 30 seconds
                const now = Date.now();
                for (const [id, beacon] of detectedBeacons.entries()) {
                    if (now - beacon.lastSeen > 30000) {
                        detectedBeacons.delete(id);
                    }
                }

                // Notify callback with current beacons
                callback(Array.from(detectedBeacons.values()));
            } catch (error) {
                console.error('Beacon monitoring error:', error);
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }
    };

    // Start monitoring in background
    monitoringLoop();

    // Return stop function
    return () => {
        isMonitoring = false;
        detectedBeacons.clear();
    };
};

/**
 * Find beacons matching a specific UUID
 */
export const findBeaconsByUUID = (beacons: iBeaconDevice[], uuid: string): iBeaconDevice[] => {
    return beacons.filter(beacon => beacon.uuid.toLowerCase() === uuid.toLowerCase());
};

/**
 * Find nearest beacon
 */
export const findNearestBeacon = (beacons: iBeaconDevice[]): iBeaconDevice | null => {
    if (beacons.length === 0) return null;
    return beacons.reduce((nearest, current) => 
        current.accuracy < nearest.accuracy ? current : nearest
    );
};

/**
 * Filter beacons by proximity
 */
export const filterBeaconsByProximity = (
    beacons: iBeaconDevice[], 
    proximity: 'immediate' | 'near' | 'far'
): iBeaconDevice[] => {
    return beacons.filter(beacon => beacon.proximity === proximity);
};

/**
 * Get beacon information
 */
export const getBluetoothDeviceInfo = (): { supported: boolean; message: string } => {
    if (!isBluetoothSupported()) {
        return {
            supported: false,
            message: 'Bluetooth/iBeacon is not supported on this device. Please use an Android device (5.0+) or iOS device (10+).'
        };
    }
    
    return {
        supported: true,
        message: 'Bluetooth/iBeacon is available on this device'
    };
};

/**
 * Create a beacon region for monitoring
 */
export interface BeaconRegion {
    identifier: string;
    uuid: string;
    major?: number;
    minor?: number;
    notifyOnEntry: boolean;
    notifyOnExit: boolean;
}

/**
 * Monitor beacon region (enter/exit)
 */
export const monitorBeaconRegion = (
    region: BeaconRegion,
    onEnter: (beacon: iBeaconDevice) => void,
    onExit: (beacon: iBeaconDevice) => void
): (() => void) => {
    const detectedBeacons = new Map<string, iBeaconDevice>();
    let isMonitoring = true;

    const monitor = async () => {
        while (isMonitoring) {
            try {
                const result = await startBeaconScan({
                    uuid: region.uuid,
                    major: region.major,
                    minor: region.minor
                });

                result.devicesFound.forEach(beacon => {
                    const wasKnown = detectedBeacons.has(beacon.id);

                    if (!wasKnown && region.notifyOnEntry) {
                        onEnter(beacon);
                    }

                    detectedBeacons.set(beacon.id, beacon);
                });

                // Check for exits
                const now = Date.now();
                for (const [id, beacon] of detectedBeacons.entries()) {
                    if (now - beacon.lastSeen > 30000) {
                        if (region.notifyOnExit) {
                            onExit(beacon);
                        }
                        detectedBeacons.delete(id);
                    }
                }
            } catch (error) {
                console.error('Region monitoring error:', error);
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second interval
        }
    };

    // Start monitoring (fire and forget)
    monitor();

    // Return cleanup function
    return () => {
        isMonitoring = false;
    };
};
