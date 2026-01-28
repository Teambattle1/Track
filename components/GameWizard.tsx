import React, { useState, useEffect, useMemo } from 'react';
import { Game, GamePoint, TaskTemplate, TaskList, PlaygroundTemplate, Playground, Coordinate } from '../types';
import {
  X, Wand2, MapPin, Calendar, FileText, CheckCircle, ChevronLeft, ChevronRight,
  Target, LayoutGrid, Sparkles, Library, List, CircleDot, Plus, Maximize2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePickerStyles.css';
import LocationSearch from './LocationSearch';
import PlaygroundLibraryModal from './PlaygroundLibraryModal';
import AiTaskGenerator from './AiTaskGenerator';
import TaskMaster from './TaskMaster';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface WizardSession {
  sessionId: string;
  gameType: 'standard' | 'playzone' | 'elimination' | null;
  location: { lat: number; lng: number; address?: string } | null;
  needsPlayzones: boolean | null;
  playzoneAction: 'import' | 'empty' | null;
  importedPlayground: PlaygroundTemplate | null;
  pendingTasks: TaskTemplate[];
  gameDate: Date | null;
  sessionName: string;
  openSettings: boolean;
}

interface GameWizardProps {
  onClose: () => void;
  onCreate: (game: Partial<Game>, openSettings: boolean) => void;
  existingPlaygrounds?: Playground[];
  taskLibrary?: TaskTemplate[];
  taskLists?: TaskList[];
  onUpdateTaskLibrary?: (library: TaskTemplate[]) => void;
  onUpdateTaskLists?: (lists: TaskList[]) => void;
  games?: Game[];
}

const TOTAL_STEPS = 7;

// Game type options
const GAME_TYPES = [
  {
    id: 'standard' as const,
    title: 'STANDARD GPS',
    description: 'Outdoor GPS-based game with map navigation',
    icon: MapPin,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'playzone' as const,
    title: 'PLAYZONE',
    description: 'Indoor virtual zones with custom layouts',
    icon: LayoutGrid,
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'elimination' as const,
    title: 'ELIMINATION',
    description: 'GPS game with elimination mechanics',
    icon: Target,
    color: 'from-red-500 to-red-600',
  },
];

// Glowing red marker for map
const createGlowingMarkerIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #ef4444;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 0 4px rgba(239,68,68,0.4), 0 0 20px rgba(239,68,68,0.6);
        animation: pulse 2s infinite;
      "></div>
      <style>
        @keyframes pulse {
          0% { box-shadow: 0 0 0 4px rgba(239,68,68,0.4), 0 0 20px rgba(239,68,68,0.6); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.2), 0 0 30px rgba(239,68,68,0.4); }
          100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.4), 0 0 20px rgba(239,68,68,0.6); }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Map center updater component
const MapCenterUpdater: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom = 15 }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Map click handler component
const MapClickHandler: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const GameWizard: React.FC<GameWizardProps> = ({
  onClose,
  onCreate,
  existingPlaygrounds = [],
  taskLibrary = [],
  taskLists = [],
  onUpdateTaskLibrary,
  onUpdateTaskLists,
  games = [],
}) => {
  // Current step (1-based)
  const [currentStep, setCurrentStep] = useState(1);

  // Session state
  const [session, setSession] = useState<WizardSession>(() => ({
    sessionId: `session-${Date.now()}`,
    gameType: null,
    location: null,
    needsPlayzones: null,
    playzoneAction: null,
    importedPlayground: null,
    pendingTasks: [],
    gameDate: null,
    sessionName: '',
    openSettings: false,
  }));

  // Sub-modal states
  const [subModal, setSubModal] = useState<'playground' | 'tasks' | 'taskLists' | 'ai' | null>(null);
  const [showAddMoreTasks, setShowAddMoreTasks] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

  // Internal task library state for TaskMaster
  const [internalTaskLibrary, setInternalTaskLibrary] = useState<TaskTemplate[]>(taskLibrary);
  const [internalTaskLists, setInternalTaskLists] = useState<TaskList[]>(taskLists);

  // Calculate effective step based on game type
  const getEffectiveStep = (step: number): number => {
    // If playzone game, skip location step (step 2)
    if (session.gameType === 'playzone' && step >= 2) {
      return step + 1;
    }
    return step;
  };

  // Get actual step number for display
  const getDisplayStep = (internalStep: number): number => {
    if (session.gameType === 'playzone' && internalStep > 1) {
      return internalStep - 1;
    }
    return internalStep;
  };

  // Calculate total steps based on game type
  const totalDisplaySteps = session.gameType === 'playzone' ? TOTAL_STEPS - 1 : TOTAL_STEPS;

  // Step validation
  const canProceed = useMemo(() => {
    const effectiveStep = getEffectiveStep(currentStep);
    switch (effectiveStep) {
      case 1: return session.gameType !== null;
      case 2: return session.location !== null; // Location step
      case 3: return session.needsPlayzones !== null; // Playzones step
      case 4: return true; // Task help - always can proceed
      case 5: return session.gameDate !== null; // Date step
      case 6: return session.sessionName.trim().length >= 3; // Name step
      case 7: return true; // Review step
      default: return false;
    }
  }, [currentStep, session]);

  // Navigation
  const nextStep = () => {
    const effectiveStep = getEffectiveStep(currentStep);

    // Handle special cases
    if (effectiveStep === 3 && session.needsPlayzones === true && !session.playzoneAction) {
      // Need to select playzone action first
      return;
    }

    // Calculate next step
    let nextInternal = currentStep + 1;

    // Skip location step for playzone games
    if (session.gameType === 'playzone' && currentStep === 1) {
      nextInternal = 2; // Go to playzones step (internally mapped to step 3)
    }

    const maxStep = session.gameType === 'playzone' ? TOTAL_STEPS - 1 : TOTAL_STEPS;
    if (nextInternal <= maxStep) {
      setCurrentStep(nextInternal);
      setShowAddMoreTasks(false);
    }
  };

  const prevStep = () => {
    let prevInternal = currentStep - 1;

    // Skip location step for playzone games
    if (session.gameType === 'playzone' && currentStep === 2) {
      prevInternal = 1; // Go back to game type
    }

    if (prevInternal >= 1) {
      setCurrentStep(prevInternal);
      setShowAddMoreTasks(false);
    }
  };

  // Handle game type selection
  const handleGameTypeSelect = (type: 'standard' | 'playzone' | 'elimination') => {
    setSession(s => ({ ...s, gameType: type }));
  };

  // Handle location selection with reverse geocoding
  const handleLocationSelect = async (coord: Coordinate) => {
    setSession(s => ({
      ...s,
      location: { lat: coord.lat, lng: coord.lng },
    }));

    // Try to get address via reverse geocoding
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coord.lat}&lon=${coord.lng}&format=json&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        // Extract a shorter address (city, road, etc.)
        const parts = [];
        if (data.address?.road) parts.push(data.address.road);
        if (data.address?.city || data.address?.town || data.address?.village) {
          parts.push(data.address.city || data.address.town || data.address.village);
        }
        const shortAddress = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 2).join(',');

        setSession(s => ({
          ...s,
          location: { lat: coord.lat, lng: coord.lng, address: shortAddress },
        }));
      }
    } catch (e) {
      console.warn('Reverse geocoding failed:', e);
    }
  };

  // Handle playzone decision
  const handlePlayzoneDecision = (needsPlayzones: boolean) => {
    setSession(s => ({
      ...s,
      needsPlayzones,
      playzoneAction: needsPlayzones ? null : null,
    }));
  };

  // Handle playzone action
  const handlePlayzoneAction = (action: 'import' | 'empty') => {
    setSession(s => ({ ...s, playzoneAction: action }));
    if (action === 'import') {
      setSubModal('playground');
    } else {
      // Create empty playground and proceed
      nextStep();
    }
  };

  // Handle playground imported
  const handlePlaygroundImported = (template: PlaygroundTemplate) => {
    setSession(s => ({ ...s, importedPlayground: template }));
    setSubModal(null);
    nextStep();
  };

  // Handle task source selection
  const handleTaskSourceSelect = (source: 'library' | 'lists' | 'ai' | 'skip') => {
    if (source === 'skip') {
      nextStep();
    } else if (source === 'library') {
      setSubModal('tasks');
    } else if (source === 'lists') {
      setSubModal('taskLists');
    } else if (source === 'ai') {
      setSubModal('ai');
    }
  };

  // Handle tasks imported from TaskMaster
  const handleTasksImported = (tasks: TaskTemplate[]) => {
    setSession(s => ({
      ...s,
      pendingTasks: [...s.pendingTasks, ...tasks],
    }));
    setSubModal(null);
    setShowAddMoreTasks(true);
  };

  // Handle tasks from AI Generator (supports multiple tasks)
  const handleAiTasksAdded = (tasks: TaskTemplate[]) => {
    setSession(s => ({
      ...s,
      pendingTasks: [...s.pendingTasks, ...tasks],
    }));
    setSubModal(null);
    setShowAddMoreTasks(true);
  };

  // Handle task list imported
  const handleTaskListImported = (list: TaskList) => {
    setSession(s => ({
      ...s,
      pendingTasks: [...s.pendingTasks, ...list.tasks],
    }));
    setSubModal(null);
    setShowAddMoreTasks(true);
  };

  // Generate auto-suggested name
  const suggestedName = useMemo(() => {
    const typeLabel = session.gameType === 'playzone' ? 'Playzone' :
                      session.gameType === 'elimination' ? 'Elimination' : 'Standard';
    const dateStr = session.gameDate
      ? session.gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'New';
    return `${typeLabel} Game - ${dateStr}`;
  }, [session.gameType, session.gameDate]);

  // Helper function to calculate spiral placement with 50m spacing
  const getOffsetLocation = (center: { lat: number; lng: number } | null, index: number): { lat: number; lng: number } | null => {
    if (!center) return null;
    if (index === 0) return center; // First task at center

    // Spiral pattern: each subsequent task is placed in a spiral outward
    const spacing = 50; // meters between points
    const metersPerLat = 111320; // approx meters per degree latitude
    const metersPerLng = 111320 * Math.cos(center.lat * Math.PI / 180); // varies by latitude

    // Calculate spiral position (Archimedean spiral)
    const angle = index * 2.4; // Golden angle in radians for nice distribution
    const radius = spacing * Math.sqrt(index); // Increase radius with sqrt for even spacing

    const latOffset = (radius * Math.sin(angle)) / metersPerLat;
    const lngOffset = (radius * Math.cos(angle)) / metersPerLng;

    return {
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset
    };
  };

  // Handle create
  const handleCreate = () => {
    const now = Date.now();

    console.log('[GameWizard] Creating session:', {
      name: session.sessionName,
      pendingTasksCount: session.pendingTasks.length,
      location: session.location,
      gameType: session.gameType
    });

    // Map pending tasks to game points with spiral placement
    const points: GamePoint[] = session.pendingTasks.map((t, i) => ({
      id: `pt-${now}-${i}`,
      title: t.title,
      task: t.task,
      location: getOffsetLocation(session.location, i),
      radiusMeters: 30,
      activationTypes: t.activationTypes || ['radius'],
      isUnlocked: i === 0,
      isCompleted: false,
      order: i,
      points: t.points || 100,
      iconId: t.iconId,
      iconUrl: t.iconUrl,
      tags: t.tags,
      feedback: t.feedback,
      settings: t.settings,
      logic: t.logic,
      colorScheme: t.colorScheme,
      playgroundId: session.importedPlayground?.playgroundData?.id,
    }));

    console.log('[GameWizard] Created', points.length, 'points from', session.pendingTasks.length, 'pending tasks');

    // Build playgrounds array
    const playgrounds: Playground[] = [];
    if (session.importedPlayground) {
      playgrounds.push({
        ...session.importedPlayground.playgroundData,
        id: session.importedPlayground.playgroundData.id || `pg-${now}`,
      });
    } else if (session.needsPlayzones && session.playzoneAction === 'empty') {
      playgrounds.push({
        id: `pg-${now}`,
        title: 'Main Zone',
        buttonVisible: true,
      });
    }

    const newGame: Partial<Game> = {
      id: `game-${now}`,
      name: session.sessionName,
      description: '',
      gameMode: session.gameType || 'standard',
      createdAt: now,
      points,
      playgrounds,
      client: session.gameDate ? {
        name: '',
        playingDate: session.gameDate.toISOString(),
      } : undefined,
      state: 'draft',
    };

    console.log('[GameWizard] Sending game to App:', {
      id: newGame.id,
      name: newGame.name,
      pointsCount: newGame.points?.length,
      playgroundsCount: newGame.playgrounds?.length
    });

    onCreate(newGame, session.openSettings);
  };

  // Render step content
  const renderStepContent = () => {
    const effectiveStep = getEffectiveStep(currentStep);

    switch (effectiveStep) {
      case 1: // Game Type
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              WHAT TYPE OF GAME?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {GAME_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = session.gameType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleGameTypeSelect(type.id)}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-black text-white uppercase tracking-wide text-sm">
                        {type.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase">
                        {type.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-orange-500 absolute top-3 right-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2: // Location
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              WHERE WILL YOU PLAY?
            </h2>

            <div className="w-full max-w-2xl mx-auto px-4">
              <LocationSearch
                onSelectLocation={handleLocationSelect}
                fullWidth={true}
                showSavedLocations={true}
              />
            </div>

            {/* Mini Map - Click to expand */}
            <div className="relative w-full max-w-md mx-auto">
              <div
                className="h-[200px] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl cursor-pointer group hover:border-orange-500 transition-colors"
                onClick={() => setShowFullscreenMap(true)}
              >
                <MapContainer
                  center={[55.6761, 12.5683]}
                  zoom={5}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenterUpdater
                    center={session.location ? [session.location.lat, session.location.lng] : [55.6761, 12.5683]}
                    zoom={session.location ? 15 : 5}
                  />
                  {session.location && (
                    <Marker
                      position={[session.location.lat, session.location.lng]}
                      icon={createGlowingMarkerIcon()}
                    />
                  )}
                </MapContainer>
                {/* Expand overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-orange-600 text-white px-4 py-2 rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-lg">
                    <Maximize2 className="w-4 h-4" />
                    Click to set location
                  </div>
                </div>
              </div>
            </div>

            {session.location && (
              <p className="text-center text-xs text-slate-400 font-bold">
                📍 {session.location.address || `${session.location.lat.toFixed(4)}, ${session.location.lng.toFixed(4)}`}
              </p>
            )}

            {/* Fullscreen Map Modal */}
            {showFullscreenMap && (
              <div className="fixed inset-0 z-[7000] bg-black/95 flex flex-col animate-in fade-in">
                {/* Header */}
                <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Select Location</h3>
                    <p className="text-xs text-slate-400">Click on the map to set your game location</p>
                  </div>
                  <button
                    onClick={() => setShowFullscreenMap(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>

                {/* Map */}
                <div className="flex-1">
                  <MapContainer
                    center={session.location ? [session.location.lat, session.location.lng] : [55.6761, 12.5683]}
                    zoom={session.location ? 15 : 6}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                    attributionControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler
                      onLocationSelect={async (lat, lng) => {
                        setSession(s => ({
                          ...s,
                          location: { lat, lng },
                        }));

                        // Reverse geocode
                        try {
                          const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
                          );
                          const data = await response.json();
                          if (data.display_name) {
                            const parts = [];
                            if (data.address?.road) parts.push(data.address.road);
                            if (data.address?.city || data.address?.town || data.address?.village) {
                              parts.push(data.address.city || data.address.town || data.address.village);
                            }
                            const shortAddress = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 2).join(',');
                            setSession(s => ({
                              ...s,
                              location: { lat, lng, address: shortAddress },
                            }));
                          }
                        } catch (e) {
                          console.warn('Reverse geocoding failed:', e);
                        }
                      }}
                    />
                    {session.location && (
                      <Marker
                        position={[session.location.lat, session.location.lng]}
                        icon={createGlowingMarkerIcon()}
                      />
                    )}
                  </MapContainer>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-between items-center shrink-0">
                  <div>
                    {session.location ? (
                      <p className="text-sm text-white font-bold">
                        📍 {session.location.address || `${session.location.lat.toFixed(5)}, ${session.location.lng.toFixed(5)}`}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">Click on map to select location</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFullscreenMap(false)}
                    disabled={!session.location}
                    className={`px-6 py-3 rounded-xl font-black uppercase text-sm transition-all ${
                      session.location
                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Playzones
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              DO YOU NEED PLAYZONES?
            </h2>

            {session.needsPlayzones === null ? (
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handlePlayzoneDecision(true)}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase tracking-wide text-sm transition-all shadow-lg"
                >
                  YES
                </button>
                <button
                  onClick={() => handlePlayzoneDecision(false)}
                  className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-black uppercase tracking-wide text-sm transition-all shadow-lg"
                >
                  NO
                </button>
              </div>
            ) : session.needsPlayzones ? (
              <div className="space-y-4">
                <p className="text-center text-slate-400 text-sm">
                  How would you like to add playzones?
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handlePlayzoneAction('import')}
                    className={`px-6 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      session.playzoneAction === 'import'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <Library className="w-6 h-6 text-orange-400" />
                    <span className="font-bold text-white uppercase text-xs">Import Template</span>
                  </button>
                  <button
                    onClick={() => handlePlayzoneAction('empty')}
                    className={`px-6 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      session.playzoneAction === 'empty'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <Plus className="w-6 h-6 text-slate-400" />
                    <span className="font-bold text-white uppercase text-xs">Create Empty</span>
                  </button>
                </div>
                <button
                  onClick={() => setSession(s => ({ ...s, needsPlayzones: null, playzoneAction: null }))}
                  className="mx-auto block text-xs text-slate-500 hover:text-white transition-colors"
                >
                  ← Change decision
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-4">
                  No playzones will be added. You can add them later in the editor.
                </p>
                <button
                  onClick={() => setSession(s => ({ ...s, needsPlayzones: null }))}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  ← Change decision
                </button>
              </div>
            )}

            {session.importedPlayground && (
              <div className="mt-6 p-4 bg-green-600/20 border border-green-600/40 rounded-xl text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-400 font-bold uppercase text-sm">
                  Imported: {session.importedPlayground.title}
                </p>
                <p className="text-green-400/60 text-xs">
                  {session.importedPlayground.tasks.length} tasks included
                </p>
              </div>
            )}
          </div>
        );

      case 4: // Task Help
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              WOULD YOU LIKE HELP WITH TASKS?
            </h2>

            {session.pendingTasks.length > 0 && (
              <div className="p-4 bg-green-600/20 border border-green-600/40 rounded-xl text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-400 font-bold uppercase text-sm">
                  {session.pendingTasks.length} TASKS ADDED
                </p>
              </div>
            )}

            {showAddMoreTasks ? (
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowAddMoreTasks(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold uppercase text-xs transition-all"
                >
                  ADD MORE TASKS
                </button>
                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold uppercase text-xs transition-all shadow-lg"
                >
                  CONTINUE →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  onClick={() => handleTaskSourceSelect('library')}
                  className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-orange-500 transition-all flex flex-col items-center gap-2"
                >
                  <Library className="w-8 h-8 text-orange-400" />
                  <span className="font-bold text-white uppercase text-xs">Task Library</span>
                </button>
                <button
                  onClick={() => handleTaskSourceSelect('lists')}
                  className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-purple-500 transition-all flex flex-col items-center gap-2"
                >
                  <List className="w-8 h-8 text-purple-400" />
                  <span className="font-bold text-white uppercase text-xs">Task Lists</span>
                </button>
                <button
                  onClick={() => handleTaskSourceSelect('ai')}
                  className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-purple-500 transition-all flex flex-col items-center gap-2"
                >
                  <Sparkles className="w-8 h-8 text-purple-400" />
                  <span className="font-bold text-white uppercase text-xs">AI Generator</span>
                </button>
                <button
                  onClick={() => handleTaskSourceSelect('skip')}
                  className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-slate-500 transition-all flex flex-col items-center gap-2"
                >
                  <ChevronRight className="w-8 h-8 text-slate-400" />
                  <span className="font-bold text-white uppercase text-xs">Skip</span>
                </button>
              </div>
            )}
          </div>
        );

      case 5: // Game Date
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              WHEN IS THE GAME?
            </h2>

            <div className="flex justify-center">
              <DatePicker
                selected={session.gameDate}
                onChange={(date) => setSession(s => ({ ...s, gameDate: date }))}
                inline
                calendarClassName="dark-datepicker"
                minDate={new Date()}
              />
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setSession(s => ({ ...s, gameDate: new Date() }))}
                className={`px-4 py-2 rounded-lg font-bold uppercase text-xs transition-all ${
                  session.gameDate?.toDateString() === new Date().toDateString()
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSession(s => ({ ...s, gameDate: tomorrow }));
                }}
                className={`px-4 py-2 rounded-lg font-bold uppercase text-xs transition-all ${
                  (() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return session.gameDate?.toDateString() === tomorrow.toDateString();
                  })()
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Tomorrow
              </button>
              <button
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setSession(s => ({ ...s, gameDate: nextWeek }));
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold uppercase text-xs transition-all"
              >
                Next Week
              </button>
            </div>

            {session.gameDate && (
              <p className="text-center text-slate-400 text-sm font-bold">
                📅 {session.gameDate.toLocaleDateString('da-DK', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        );

      case 6: // Session Name
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              NAME YOUR SESSION
            </h2>

            <div className="max-w-md mx-auto">
              <input
                type="text"
                value={session.sessionName}
                onChange={(e) => setSession(s => ({ ...s, sessionName: e.target.value }))}
                placeholder={suggestedName}
                className="w-full p-4 bg-slate-800 border-2 border-slate-700 focus:border-orange-500 rounded-xl text-white font-bold text-center outline-none transition-all"
              />
              <p className="text-center text-xs text-slate-500 mt-2">
                Minimum 3 characters
              </p>

              {session.sessionName.length < 3 && (
                <button
                  onClick={() => setSession(s => ({ ...s, sessionName: suggestedName }))}
                  className="mx-auto block mt-4 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Use suggested: "{suggestedName}"
                </button>
              )}
            </div>
          </div>
        );

      case 7: // Review & Create
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
              READY TO CREATE!
            </h2>

            <div className="max-w-md mx-auto space-y-3">
              {/* Summary Cards */}
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Game Type</p>
                    <p className="text-white font-bold uppercase">
                      {session.gameType === 'playzone' ? 'Playzone' :
                       session.gameType === 'elimination' ? 'Elimination' : 'Standard GPS'}
                    </p>
                  </div>
                </div>
              </div>

              {session.location && (
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Location</p>
                      <p className="text-white font-bold">
                        {session.location.address || `${session.location.lat.toFixed(4)}, ${session.location.lng.toFixed(4)}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Tasks</p>
                    <p className="text-white font-bold">{session.pendingTasks.length} tasks ready</p>
                  </div>
                </div>
              </div>

              {session.importedPlayground && (
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Playzone</p>
                      <p className="text-white font-bold">{session.importedPlayground.title}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Date</p>
                    <p className="text-white font-bold">
                      {session.gameDate?.toLocaleDateString('da-DK', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Session Name</p>
                    <p className="text-white font-bold">{session.sessionName}</p>
                  </div>
                </div>
              </div>

              {/* Open Settings Checkbox */}
              <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={session.openSettings}
                  onChange={(e) => setSession(s => ({ ...s, openSettings: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-slate-300 text-sm font-bold">
                  Open settings after creation
                </span>
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Progress dots
  const renderProgressDots = () => {
    const dots = [];
    for (let i = 1; i <= totalDisplaySteps; i++) {
      const displayStep = getDisplayStep(currentStep);
      const isActive = i === displayStep;
      const isCompleted = i < displayStep;

      dots.push(
        <React.Fragment key={i}>
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              isActive
                ? 'bg-orange-500 ring-4 ring-orange-500/30'
                : isCompleted
                ? 'bg-orange-500'
                : 'bg-slate-700'
            }`}
          />
          {i < totalDisplaySteps && (
            <div
              className={`flex-1 h-0.5 ${
                isCompleted ? 'bg-orange-500' : 'bg-slate-700'
              }`}
            />
          )}
        </React.Fragment>
      );
    }
    return dots;
  };

  return (
    <>
      {/* Main Wizard Modal */}
      <div className="fixed inset-0 z-[6000] bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-orange-600 to-orange-700 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <Wand2 className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider">GAME WIZARD</h2>
                <p className="text-[10px] text-orange-100 font-bold uppercase tracking-wider">
                  Quick create your game
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
            <div className="flex items-center gap-2">
              {renderProgressDots()}
            </div>
            <p className="text-center text-[10px] text-slate-500 font-bold uppercase mt-2">
              Step {getDisplayStep(currentStep)} of {totalDisplaySteps}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderStepContent()}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center shrink-0">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold uppercase text-xs transition-all ${
                currentStep === 1
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {getEffectiveStep(currentStep) === 7 ? (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-black uppercase text-sm transition-all shadow-lg"
              >
                <CheckCircle className="w-5 h-5" />
                CREATE SESSION
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!canProceed}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase text-sm transition-all ${
                  canProceed
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      {subModal === 'playground' && (
        <PlaygroundLibraryModal
          onClose={() => setSubModal(null)}
          onImport={handlePlaygroundImported}
        />
      )}

      {subModal === 'ai' && (
        <div className="fixed inset-0 z-[6500] bg-black/80 flex items-center justify-center p-4">
          <AiTaskGenerator
            onClose={() => setSubModal(null)}
            onAddTasks={handleAiTasksAdded}
            onAddToLibrary={handleAiTasksAdded}
            onAddTasksToList={(listId, tasks) => {
              // Add tasks to the wizard's pending tasks
              handleAiTasksAdded(tasks);
              // Also update the task list if callback provided
              if (onUpdateTaskLists) {
                const updatedLists = internalTaskLists.map(list =>
                  list.id === listId
                    ? { ...list, tasks: [...(list.tasks || []), ...tasks] }
                    : list
                );
                setInternalTaskLists(updatedLists);
                onUpdateTaskLists(updatedLists);
              }
            }}
            onCreateListWithTasks={(name, tasks) => {
              // Add tasks to the wizard's pending tasks
              handleAiTasksAdded(tasks);
              // Also create the new task list
              if (onUpdateTaskLists) {
                const newList: TaskList = {
                  id: `list-${Date.now()}`,
                  name,
                  description: '',
                  tasks,
                  color: '#3b82f6',
                  createdAt: Date.now(),
                };
                const updatedLists = [...internalTaskLists, newList];
                setInternalTaskLists(updatedLists);
                onUpdateTaskLists(updatedLists);
              }
            }}
            taskLists={internalTaskLists}
            targetMode="LIBRARY"
          />
        </div>
      )}

      {(subModal === 'tasks' || subModal === 'taskLists') && (
        <div className="fixed inset-0 z-[6500] bg-black/80 flex items-center justify-center p-4">
          <TaskMaster
            onClose={() => setSubModal(null)}
            onImportTasks={handleTasksImported}
            onImportTaskList={handleTaskListImported}
            taskLists={internalTaskLists}
            onUpdateTaskLists={(lists) => {
              setInternalTaskLists(lists);
              onUpdateTaskLists?.(lists);
            }}
            taskLibrary={internalTaskLibrary}
            onUpdateTaskLibrary={(lib) => {
              setInternalTaskLibrary(lib);
              onUpdateTaskLibrary?.(lib);
            }}
            games={games}
            initialTab={subModal === 'taskLists' ? 'LISTS' : 'LIBRARY'}
          />
        </div>
      )}
    </>
  );
};

export default GameWizard;
