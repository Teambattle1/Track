import { validatePlayzoneGame, cleanPlayzoneGame, isPointSuitableForPlayzone, getGpsOnlyPoints, getUnsuutablePlayzonePoints } from './playzoneValidation';
import { Game, GamePoint } from '../types';

// Helper to create a minimal game
const createGame = (overrides: Partial<Game> = {}): Game => ({
    id: 'test-game',
    name: 'Test Game',
    description: '',
    createdAt: Date.now(),
    points: [],
    ...overrides,
});

// Helper to create a minimal point
const createPoint = (overrides: Partial<GamePoint> = {}): GamePoint => ({
    id: `point-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Point',
    location: { lat: 55.6761, lng: 12.5683 },
    radiusMeters: 50,
    iconId: 'default',
    points: 100,
    activationTypes: ['qr'],
    isUnlocked: true,
    isCompleted: false,
    order: 0,
    task: { type: 'text', question: 'Test question' },
    ...overrides,
});

describe('validatePlayzoneGame', () => {
    describe('Non-playzone games', () => {
        it('should return valid for standard games', () => {
            const game = createGame({ gameMode: 'standard' });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should return valid for games without gameMode set', () => {
            const game = createGame();

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(true);
        });
    });

    describe('Playzone game validation', () => {
        it('should fail validation when no playgrounds exist', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [],
                points: [createPoint()],
            });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('❌ Playzone games require at least one playground. Add playgrounds through the game editor.');
        });

        it('should fail validation when no points exist', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [{ id: 'pg-1', title: 'Test Playground', buttonVisible: true, iconId: 'default' }],
                points: [],
            });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('❌ Playzone game has no tasks. Add tasks before playing.');
        });

        it('should pass validation with valid playzone config', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [{ id: 'pg-1', title: 'Test Playground', buttonVisible: true, iconId: 'default' }],
                points: [createPoint({ activationTypes: ['qr'] })],
                defaultMapStyle: 'none',
            });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should warn about GPS-only tasks', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [{ id: 'pg-1', title: 'Test Playground', buttonVisible: true, iconId: 'default' }],
                points: [
                    createPoint({ activationTypes: ['radius'] }), // GPS only
                    createPoint({ activationTypes: ['qr'] }), // QR only
                ],
            });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('1 task(s) only have GPS activation'))).toBe(true);
        });

        it('should warn about map style not being "none"', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [{ id: 'pg-1', title: 'Test Playground', buttonVisible: true, iconId: 'default' }],
                points: [createPoint()],
                defaultMapStyle: 'osm',
            });

            const result = validatePlayzoneGame(game);

            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('Playzone games should have "No Map View" style'))).toBe(true);
        });

        it('should warn about meeting points being enabled', () => {
            const game = createGame({
                gameMode: 'playzone',
                playgrounds: [{ id: 'pg-1', title: 'Test Playground', buttonVisible: true, iconId: 'default' }],
                points: [createPoint()],
                enableMeetingPoint: true,
            });

            const result = validatePlayzoneGame(game);

            expect(result.warnings.some(w => w.includes('Meeting points are not supported'))).toBe(true);
        });
    });
});

describe('cleanPlayzoneGame', () => {
    it('should not modify non-playzone games', () => {
        const game = createGame({
            gameMode: 'standard',
            defaultMapStyle: 'osm',
            points: [createPoint({ activationTypes: ['radius', 'qr'] })],
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.defaultMapStyle).toBe('osm');
        expect(cleaned.points?.[0].activationTypes).toContain('radius');
    });

    it('should remove GPS activation from all points', () => {
        const game = createGame({
            gameMode: 'playzone',
            points: [
                createPoint({ activationTypes: ['radius', 'qr'] }),
                createPoint({ activationTypes: ['radius'] }),
                createPoint({ activationTypes: ['qr', 'nfc'] }),
            ],
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.points?.[0].activationTypes).toEqual(['qr']);
        expect(cleaned.points?.[1].activationTypes).toEqual([]);
        expect(cleaned.points?.[2].activationTypes).toEqual(['qr', 'nfc']);
    });

    it('should set map style to none', () => {
        const game = createGame({
            gameMode: 'playzone',
            defaultMapStyle: 'osm',
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.defaultMapStyle).toBe('none');
    });

    it('should disable meeting point', () => {
        const game = createGame({
            gameMode: 'playzone',
            enableMeetingPoint: true,
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.enableMeetingPoint).toBe(false);
    });

    it('should disable player locations', () => {
        const game = createGame({
            gameMode: 'playzone',
            showPlayerLocations: true,
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.showPlayerLocations).toBe(false);
    });

    it('should set hideMyLocation in map config', () => {
        const game = createGame({
            gameMode: 'playzone',
        });

        const cleaned = cleanPlayzoneGame(game);

        expect(cleaned.mapConfig?.hideMyLocation).toBe(true);
    });

    it('should not mutate original game', () => {
        const game = createGame({
            gameMode: 'playzone',
            points: [createPoint({ activationTypes: ['radius', 'qr'] })],
        });
        const originalActivationTypes = [...(game.points?.[0].activationTypes || [])];

        cleanPlayzoneGame(game);

        expect(game.points?.[0].activationTypes).toEqual(originalActivationTypes);
    });
});

describe('isPointSuitableForPlayzone', () => {
    it('should return false for points with no activation types', () => {
        const point = createPoint({ activationTypes: [] });

        expect(isPointSuitableForPlayzone(point)).toBe(false);
    });

    it('should return false for GPS-only points', () => {
        const point = createPoint({ activationTypes: ['radius'] });

        expect(isPointSuitableForPlayzone(point)).toBe(false);
    });

    it('should return true for QR-only points', () => {
        const point = createPoint({ activationTypes: ['qr'] });

        expect(isPointSuitableForPlayzone(point)).toBe(true);
    });

    it('should return true for NFC-only points', () => {
        const point = createPoint({ activationTypes: ['nfc'] });

        expect(isPointSuitableForPlayzone(point)).toBe(true);
    });

    it('should return true for iBeacon points', () => {
        const point = createPoint({ activationTypes: ['ibeacon'] });

        expect(isPointSuitableForPlayzone(point)).toBe(true);
    });

    it('should return true for click activation points', () => {
        const point = createPoint({ activationTypes: ['click'] });

        expect(isPointSuitableForPlayzone(point)).toBe(true);
    });

    it('should return true for points with multiple activations including GPS', () => {
        const point = createPoint({ activationTypes: ['radius', 'qr'] });

        expect(isPointSuitableForPlayzone(point)).toBe(true);
    });

    it('should handle undefined activationTypes', () => {
        const point = createPoint();
        delete (point as any).activationTypes;

        expect(isPointSuitableForPlayzone(point)).toBe(false);
    });
});

describe('getGpsOnlyPoints', () => {
    it('should return empty array for non-playzone games', () => {
        const game = createGame({
            gameMode: 'standard',
            points: [createPoint({ activationTypes: ['radius'] })],
        });

        const result = getGpsOnlyPoints(game);

        expect(result).toHaveLength(0);
    });

    it('should return empty array when no points exist', () => {
        const game = createGame({
            gameMode: 'playzone',
            points: undefined,
        });

        const result = getGpsOnlyPoints(game);

        expect(result).toHaveLength(0);
    });

    it('should identify GPS-only points', () => {
        const gpsOnlyPoint = createPoint({ id: 'gps-only', activationTypes: ['radius'] });
        const qrPoint = createPoint({ id: 'qr-point', activationTypes: ['qr'] });
        const mixedPoint = createPoint({ id: 'mixed', activationTypes: ['radius', 'qr'] });

        const game = createGame({
            gameMode: 'playzone',
            points: [gpsOnlyPoint, qrPoint, mixedPoint],
        });

        const result = getGpsOnlyPoints(game);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('gps-only');
    });

    it('should not include points with no activation', () => {
        const noActivation = createPoint({ activationTypes: [] });

        const game = createGame({
            gameMode: 'playzone',
            points: [noActivation],
        });

        const result = getGpsOnlyPoints(game);

        expect(result).toHaveLength(0);
    });
});

describe('getUnsuutablePlayzonePoints', () => {
    it('should return empty array for non-playzone games', () => {
        const game = createGame({
            gameMode: 'standard',
            points: [createPoint({ activationTypes: [] })],
        });

        const result = getUnsuutablePlayzonePoints(game);

        expect(result).toHaveLength(0);
    });

    it('should identify all unsuitable points', () => {
        const gpsOnlyPoint = createPoint({ id: 'gps-only', activationTypes: ['radius'] });
        const noActivation = createPoint({ id: 'no-activation', activationTypes: [] });
        const qrPoint = createPoint({ id: 'qr-point', activationTypes: ['qr'] });

        const game = createGame({
            gameMode: 'playzone',
            points: [gpsOnlyPoint, noActivation, qrPoint],
        });

        const result = getUnsuutablePlayzonePoints(game);

        expect(result).toHaveLength(2);
        expect(result.map(p => p.id)).toContain('gps-only');
        expect(result.map(p => p.id)).toContain('no-activation');
    });

    it('should return empty array when all points are suitable', () => {
        const game = createGame({
            gameMode: 'playzone',
            points: [
                createPoint({ activationTypes: ['qr'] }),
                createPoint({ activationTypes: ['nfc', 'ibeacon'] }),
            ],
        });

        const result = getUnsuutablePlayzonePoints(game);

        expect(result).toHaveLength(0);
    });
});
