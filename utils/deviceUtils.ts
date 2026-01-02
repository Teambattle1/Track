import { DeviceType, DeviceLayout, ToolbarPosition } from '../types';

/**
 * Device viewport dimensions for editor preview and detection
 */
export const DEVICE_SPECS: Record<DeviceType, { width: number; height: number; defaultOrientation: 'portrait' | 'landscape' }> = {
  mobile: {
    width: 375,
    height: 812,
    defaultOrientation: 'portrait',
  },
  tablet: {
    width: 1024,
    height: 768,
    defaultOrientation: 'landscape',
  },
  desktop: {
    width: 1920,
    height: 1080,
    defaultOrientation: 'landscape',
  },
};

/**
 * Detect device type based on window/screen dimensions
 * Called automatically when game is loaded on a device
 */
export const detectDeviceType = (): DeviceType => {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  const height = window.innerHeight;
  const screenWidth = window.screen.width;

  // Mobile: width < 768px
  if (width < 768) {
    return 'mobile';
  }

  // Tablet: width between 768px and 1280px (or screen width for tablets like iPad)
  if (width < 1280 || (screenWidth >= 768 && screenWidth <= 1280)) {
    return 'tablet';
  }

  // Desktop: width >= 1280px
  return 'desktop';
};

/**
 * Get device type with user agent check (for more accurate detection)
 * Considers common tablet user agents
 */
export const detectDeviceTypeWithUA = (): DeviceType => {
  if (typeof navigator === 'undefined') return detectDeviceType();

  const ua = navigator.userAgent.toLowerCase();
  
  // iPad, Android tablets
  if (/ipad|android(?!.*mobile)/.test(ua)) {
    return 'tablet';
  }

  // Mobile devices
  if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
    return 'mobile';
  }

  // Fallback to viewport detection
  return detectDeviceType();
};

/**
 * Default device layouts for new playgrounds
 */
export const getDefaultDeviceLayouts = (): Record<DeviceType, DeviceLayout> => ({
  mobile: {
    orientationLock: 'landscape',
    qrScannerPos: { x: window.innerWidth - 120, y: window.innerHeight - 100 },
    iconPositions: {},
    buttonVisible: true,
    iconScale: 1.0,
  },
  tablet: {
    orientationLock: 'landscape',
    qrScannerPos: { x: window.innerWidth - 120, y: window.innerHeight - 100 },
    iconPositions: {},
    buttonVisible: true,
    iconScale: 1.0,
  },
  desktop: {
    orientationLock: 'landscape',
    qrScannerPos: { x: window.innerWidth - 120, y: window.innerHeight - 100 },
    iconPositions: {},
    buttonVisible: true,
    iconScale: 1.0,
  },
});

/**
 * Get layout for a specific device type
 * Falls back to default if not configured
 */
export const getDeviceLayout = (
  deviceLayouts: Record<DeviceType, DeviceLayout> | undefined,
  deviceType: DeviceType
): DeviceLayout => {
  if (deviceLayouts && deviceLayouts[deviceType]) {
    return deviceLayouts[deviceType];
  }

  return getDefaultDeviceLayouts()[deviceType];
};

/**
 * Get viewport dimensions for a device type considering orientation
 */
export const getViewportDimensions = (
  deviceType: DeviceType,
  orientation: 'portrait' | 'landscape'
): { width: number; height: number } => {
  const spec = DEVICE_SPECS[deviceType];
  
  if (orientation === 'portrait') {
    return {
      width: Math.min(spec.width, spec.height),
      height: Math.max(spec.width, spec.height),
    };
  }

  return {
    width: Math.max(spec.width, spec.height),
    height: Math.min(spec.width, spec.height),
  };
};

/**
 * Scale position from one viewport to another
 * Useful for adapting positions from editor to different device sizes
 */
export const scalePosition = (
  pos: { x: number; y: number },
  fromViewport: { width: number; height: number },
  toViewport: { width: number; height: number }
): { x: number; y: number } => {
  return {
    x: (pos.x / fromViewport.width) * toViewport.width,
    y: (pos.y / fromViewport.height) * toViewport.height,
  };
};

/**
 * Get toolbar position for current device
 * Falls back to non-device-specific position if per-device version not found
 */
export const getToolbarPosition = (
  toolbarPositions: any | undefined,
  posKey: string,
  deviceType: DeviceType
): ToolbarPosition | undefined => {
  if (!toolbarPositions) return undefined;

  // Try device-specific position first
  const deviceKey = `${posKey}PerDevice`;
  if (toolbarPositions[deviceKey] && toolbarPositions[deviceKey][deviceType]) {
    return toolbarPositions[deviceKey][deviceType];
  }

  // Fall back to default position
  return toolbarPositions[posKey];
};

/**
 * Save toolbar position for current device
 */
export const saveToolbarPositionPerDevice = (
  toolbarPositions: any | undefined,
  posKey: string,
  deviceType: DeviceType,
  position: ToolbarPosition
): any => {
  const updated = { ...toolbarPositions };
  const deviceKey = `${posKey}PerDevice`;

  if (!updated[deviceKey]) {
    updated[deviceKey] = {};
  }

  updated[deviceKey] = {
    ...updated[deviceKey],
    [deviceType]: position,
  };

  return updated;
};

/**
 * Ensure device layouts exist for a playground
 * For backward compatibility with existing games
 */
export const ensureDeviceLayouts = (
  deviceLayouts: Record<DeviceType, DeviceLayout> | undefined
): Record<DeviceType, DeviceLayout> => {
  const defaults = getDefaultDeviceLayouts();

  if (!deviceLayouts) {
    return defaults;
  }

  // Ensure all device types exist
  const filled: Record<DeviceType, DeviceLayout> = {
    mobile: deviceLayouts.mobile || defaults.mobile,
    tablet: deviceLayouts.tablet || defaults.tablet,
    desktop: deviceLayouts.desktop || defaults.desktop,
  };

  return filled;
};
