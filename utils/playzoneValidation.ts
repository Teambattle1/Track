import { Game, GamePoint } from '../types';

/**
 * Validate playzone game configuration
 * Ensures game has all required settings for indoor, playground-based gameplay
 */
export const validatePlayzoneGame = (game: Game): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Only validate if it's a playzone game
    if (game.gameMode !== 'playzone') {
        return { valid: true, errors: [], warnings: [] };
    }

    // 1. Check playgrounds
    if (!game.playgrounds || game.playgrounds.length === 0) {
        errors.push('❌ Playzone games require at least one playground. Add playgrounds through the game editor.');
    }

    // 2. Check points exist
    if (!game.points || game.points.length === 0) {
        errors.push('❌ Playzone game has no tasks. Add tasks before playing.');
    }

    // 3. Check for suitable activations (non-GPS)
    if (game.points && game.points.length > 0) {
        const gpsOnlyTasks = game.points.filter(p => {
            if (!p.activationTypes || p.activationTypes.length === 0) return false;
            // Check if ONLY has GPS activation
            const hasOnlyGps = p.activationTypes.length === 1 && p.activationTypes.includes('radius');
            return hasOnlyGps;
        });

        if (gpsOnlyTasks.length > 0) {
            warnings.push(
                `⚠️ ${gpsOnlyTasks.length} task(s) only have GPS activation and cannot be used in playzone mode. ` +
                `Add QR, NFC, iBeacon, or Click methods to these tasks.`
            );
        }
    }

    // 4. Check map style (should not be set for playzone)
    if (game.defaultMapStyle && game.defaultMapStyle !== 'none') {
        warnings.push(`⚠️ Playzone games should have "No Map View" style. Current: ${game.defaultMapStyle}`);
    }

    // 5. Check meeting point (should be disabled for playzone)
    if (game.enableMeetingPoint === true) {
        warnings.push('⚠️ Meeting points are not supported in playzone games and will be ignored.');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Clean playzone game data before saving
 * Removes GPS activations and disables map-related features
 */
export const cleanPlayzoneGame = (game: Game): Game => {
    if (game.gameMode !== 'playzone') {
        return game;
    }

    // Create a copy to avoid mutations
    const cleaned = { ...game };

    // Remove GPS activation from all points
    if (cleaned.points && Array.isArray(cleaned.points)) {
        cleaned.points = cleaned.points.map(point => ({
            ...point,
            activationTypes: (point.activationTypes || []).filter(type => type !== 'radius'),
            // Keep location and radiusMeters for potential future use, but GPS won't be active
        }));
    }

    // Disable map-related features for playzone
    cleaned.defaultMapStyle = 'none';
    cleaned.enableMeetingPoint = false;
    cleaned.showPlayerLocations = false;

    // Ensure map config is set appropriately
    if (!cleaned.mapConfig) {
        cleaned.mapConfig = {
            pinDisplayMode: 'none',
            showShortIntroUnderPin: false,
            mapInteraction: 'disable_click',
            hideMyLocation: true,
            showMyTrack: false,
            allowNavigation: false,
            allowWeakGps: false
        };
    } else {
        cleaned.mapConfig.hideMyLocation = true;
    }

    return cleaned;
};

/**
 * Check if a game point is suitable for playzone (has non-GPS activation)
 */
export const isPointSuitableForPlayzone = (point: GamePoint): boolean => {
    if (!point.activationTypes || point.activationTypes.length === 0) {
        return false; // No activation method
    }

    // Check if has at least one non-GPS activation
    return point.activationTypes.some(type => type !== 'radius');
};

/**
 * Get all GPS-only points from a game
 */
export const getGpsOnlyPoints = (game: Game): GamePoint[] => {
    if (!game.points || game.gameMode !== 'playzone') {
        return [];
    }

    return game.points.filter(point => {
        if (!point.activationTypes || point.activationTypes.length === 0) return false;
        return point.activationTypes.length === 1 && point.activationTypes.includes('radius');
    });
};

/**
 * Get all points unsuitable for playzone
 */
export const getUnsuutablePlayzonePoints = (game: Game): GamePoint[] => {
    if (!game.points || game.gameMode !== 'playzone') {
        return [];
    }

    return game.points.filter(point => !isPointSuitableForPlayzone(point));
};
