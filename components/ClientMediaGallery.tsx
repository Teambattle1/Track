import React, { useState, useEffect } from 'react';
import { Game, Team, MediaSubmission } from '../types';
import * as db from '../services/db';
import { Image as ImageIcon, Video, Play, Grid3x3, Filter, X, ChevronLeft, ChevronRight, Maximize2, Download, Trophy, Award, Medal, Crown } from 'lucide-react';

interface ClientMediaGalleryProps {
  gameId: string;
  game: Game;
  teams: Team[];
}

interface RankingSlideProps {
  teams: Team[];
  revealedTop3: number;
}

const RankingSlide: React.FC<RankingSlideProps> = ({ teams, revealedTop3 }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sort teams by score
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  // Auto-scroll to bottom on first render
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Get podium teams
  const gold = sortedTeams[0];
  const silver = sortedTeams[1];
  const bronze = sortedTeams[2];
  const rest = sortedTeams.slice(3);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-8">
      {/* Podium - Top 3 (Hidden until revealed) */}
      <div className="mb-8">
        <h2 className="text-6xl font-black text-white uppercase text-center mb-12 tracking-wider">
          🏆 CHAMPIONS 🏆
        </h2>
        <div className="flex items-end justify-center gap-8 max-w-5xl mx-auto">
          {/* Silver - 2nd Place */}
          <div className={`flex flex-col items-center transition-all duration-700 ${
            revealedTop3 >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}>
            <div className="w-48 h-48 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mb-4 border-8 border-white shadow-2xl">
              <Medal className="w-24 h-24 text-white" />
            </div>
            <div className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl p-6 min-w-[280px] text-center shadow-2xl">
              <div className="text-7xl font-black text-white mb-2">2</div>
              <h3 className="text-3xl font-black text-white uppercase mb-3">{silver?.name}</h3>
              <p className="text-5xl font-black text-white">{silver?.score} pts</p>
            </div>
          </div>

          {/* Gold - 1st Place */}
          <div className={`flex flex-col items-center transition-all duration-700 ${
            revealedTop3 >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}>
            <div className="w-64 h-64 bg-gradient-to-br from-amber-300 to-amber-500 rounded-full flex items-center justify-center mb-4 border-8 border-white shadow-2xl animate-pulse">
              <Crown className="w-32 h-32 text-white" />
            </div>
            <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl p-8 min-w-[320px] text-center shadow-2xl">
              <div className="text-8xl font-black text-white mb-3">1</div>
              <h3 className="text-4xl font-black text-white uppercase mb-4">{gold?.name}</h3>
              <p className="text-6xl font-black text-white">{gold?.score} pts</p>
            </div>
          </div>

          {/* Bronze - 3rd Place */}
          <div className={`flex flex-col items-center transition-all duration-700 ${
            revealedTop3 >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}>
            <div className="w-40 h-40 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center mb-4 border-8 border-white shadow-2xl">
              <Award className="w-20 h-20 text-white" />
            </div>
            <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-5 min-w-[260px] text-center shadow-2xl">
              <div className="text-6xl font-black text-white mb-2">3</div>
              <h3 className="text-2xl font-black text-white uppercase mb-2">{bronze?.name}</h3>
              <p className="text-4xl font-black text-white">{bronze?.score} pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rest of Rankings - Scrollable */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar bg-black/30 rounded-2xl p-6"
      >
        <h3 className="text-3xl font-black text-white uppercase text-center mb-6">Full Leaderboard</h3>
        <div className="space-y-3 max-w-4xl mx-auto">
          {sortedTeams.map((team, index) => (
            <div
              key={team.id}
              className={`flex items-center justify-between p-5 rounded-xl transition-all ${
                index === 0 ? 'bg-gradient-to-r from-amber-600 to-amber-700 scale-105' :
                index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                index === 2 ? 'bg-gradient-to-r from-amber-700 to-amber-800' :
                'bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-black ${
                  index < 3 ? 'text-white' : 'text-gray-400'
                } min-w-[60px] text-center`}>
                  #{index + 1}
                </div>
                <h4 className={`text-2xl font-black uppercase ${
                  index < 3 ? 'text-white' : 'text-gray-300'
                }`}>
                  {team.name}
                </h4>
              </div>
              <div className={`text-4xl font-black ${
                index < 3 ? 'text-white' : 'text-gray-400'
              }`}>
                {team.score} pts
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ClientMediaGallery: React.FC<ClientMediaGalleryProps> = ({ gameId, game, teams }) => {
  const [media, setMedia] = useState<MediaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaSubmission[]>([]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showRankingSlide, setShowRankingSlide] = useState(false);
  const [revealedTop3, setRevealedTop3] = useState<number>(0); // 0 = none, 1 = bronze, 2 = silver, 3 = gold
  
  // Filters
  const [filterTask, setFilterTask] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');

  // Load media
  useEffect(() => {
    loadMedia();
  }, [gameId]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const submissions = await db.getMediaSubmissions(gameId);
      // Show all media (approved or not)
      setMedia(submissions);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter media
  const filteredMedia = media.filter(m => {
    if (filterTask !== 'all' && m.pointId !== filterTask) return false;
    if (filterTeam !== 'all' && m.teamId !== filterTeam) return false;
    if (filterType !== 'all' && m.mediaType !== filterType) return false;
    return true;
  });

  const tasks = game.points.filter(p => !p.isSectionHeader && !p.playgroundId);

  const toggleMediaSelection = (mediaItem: MediaSubmission) => {
    if (selectedMedia.find(m => m.id === mediaItem.id)) {
      setSelectedMedia(selectedMedia.filter(m => m.id !== mediaItem.id));
    } else {
      setSelectedMedia([...selectedMedia, mediaItem]);
    }
  };

  const startPresentation = () => {
    if (selectedMedia.length > 0) {
      setPresentationMode(true);
      setCurrentSlideIndex(0);
    }
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % selectedMedia.length);
  };

  const previousSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + selectedMedia.length) % selectedMedia.length);
  };

  const exitPresentation = () => {
    setPresentationMode(false);
    setCurrentSlideIndex(0);
  };

  // Keyboard navigation for presentation
  useEffect(() => {
    if (!presentationMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') previousSlide();
      if (e.key === 'Escape') exitPresentation();

      // Spacebar reveals top 3 positions one by one when on ranking slide
      if (e.key === ' ' && showRankingSlide) {
        e.preventDefault();
        if (revealedTop3 < 3) {
          setRevealedTop3(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [presentationMode, selectedMedia, showRankingSlide, revealedTop3]);

  // Presentation Mode View
  if (presentationMode && selectedMedia.length > 0) {
    const currentMedia = selectedMedia[currentSlideIndex];

    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="text-white">
              {!showRankingSlide ? (
                <>
                  <p className="font-bold">{currentMedia.teamName}</p>
                  <p className="text-sm text-gray-400">{currentMedia.pointTitle}</p>
                </>
              ) : (
                <>
                  <p className="font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    FINAL RANKINGS
                  </p>
                  <p className="text-sm text-gray-400">
                    {revealedTop3 === 0 && 'Press SPACEBAR or REVEAL TOP 3 to unveil winners'}
                    {revealedTop3 === 1 && 'Press SPACEBAR for 2nd place'}
                    {revealedTop3 === 2 && 'Press SPACEBAR for 1st place'}
                    {revealedTop3 === 3 && 'All winners revealed!'}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!showRankingSlide && (
                <>
                  <span className="text-white font-bold">
                    {currentSlideIndex + 1} / {selectedMedia.length}
                  </span>
                  <button
                    onClick={() => {
                      setShowRankingSlide(true);
                      setRevealedTop3(0);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                  >
                    <Trophy className="w-5 h-5" />
                    REVEAL RANKING
                  </button>
                </>
              )}
              {showRankingSlide && revealedTop3 < 3 && (
                <button
                  onClick={() => setRevealedTop3(prev => prev + 1)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 animate-pulse"
                >
                  <Trophy className="w-5 h-5" />
                  REVEAL TOP 3
                </button>
              )}
              <button
                onClick={exitPresentation}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content: Media or Ranking */}
        {!showRankingSlide ? (
          <div className="flex-1 flex items-center justify-center p-4 pb-32">
            {currentMedia.mediaType === 'photo' ? (
              <img
                src={currentMedia.mediaUrl}
                alt={currentMedia.pointTitle}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video
                src={currentMedia.mediaUrl}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            )}
          </div>
        ) : (
          <RankingSlide
            teams={teams}
            revealedTop3={revealedTop3}
          />
        )}

        {/* Large Task Text for Projector (Bottom Overlay) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-20 pb-6 px-8">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-5xl md:text-6xl lg:text-7xl font-black text-white uppercase tracking-wide leading-tight drop-shadow-2xl">
              {currentMedia.pointTitle}
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 text-xl md:text-2xl font-bold text-gray-300">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                {currentMedia.teamName}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">
                {currentSlideIndex + 1} / {selectedMedia.length}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 p-4">
          <button
            onClick={previousSlide}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 p-4">
          <button
            onClick={nextSlide}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

      </div>
    );
  }

  // Gallery View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
          <Grid3x3 className="w-7 h-7 text-teal-400" />
          Media Gallery
        </h2>
        {selectedMedia.length > 0 && (
          <button
            onClick={startPresentation}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold transition-colors"
          >
            <Play className="w-5 h-5" />
            Play Presentation ({selectedMedia.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-white">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Task Filter */}
          <select
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="px-3 py-2 bg-purple-900/50 border border-purple-500/50 rounded-lg text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="all">All Tasks</option>
            {tasks.map(task => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="px-3 py-2 bg-purple-900/50 border border-purple-500/50 rounded-lg text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 bg-purple-900/50 border border-purple-500/50 rounded-lg text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="all">All Media</option>
            <option value="photo">Photos Only</option>
            <option value="video">Videos Only</option>
          </select>
        </div>
        <div className="mt-3 text-sm text-gray-400">
          Showing {filteredMedia.length} of {media.length} items
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading media...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 font-bold">No media found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredMedia.map(mediaItem => {
            const isSelected = selectedMedia.find(m => m.id === mediaItem.id);

            return (
              <div
                key={mediaItem.id}
                onClick={() => toggleMediaSelection(mediaItem)}
                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                  isSelected ? 'border-teal-500 scale-105' : 'border-transparent hover:border-purple-500'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-800">
                  {mediaItem.mediaType === 'photo' ? (
                    <img
                      src={mediaItem.mediaUrl}
                      alt={mediaItem.pointTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-900/50">
                      <Video className="w-12 h-12 text-purple-400" />
                    </div>
                  )}
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-bold text-sm truncate">{mediaItem.teamName}</p>
                    <p className="text-gray-300 text-xs truncate">{mediaItem.pointTitle}</p>
                  </div>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  <div className={`p-1.5 rounded-lg ${
                    mediaItem.mediaType === 'photo' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {mediaItem.mediaType === 'photo' ? (
                      <ImageIcon className="w-3 h-3 text-white" />
                    ) : (
                      <Video className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientMediaGallery;
