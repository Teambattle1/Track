import React, { useState, useEffect } from 'react';
import { Game, Team, MediaSubmission } from '../types';
import * as db from '../services/db';
import { Image as ImageIcon, Video, Play, Grid3x3, Filter, X, ChevronLeft, ChevronRight, Maximize2, Download } from 'lucide-react';

interface ClientMediaGalleryProps {
  gameId: string;
  game: Game;
  teams: Team[];
}

const ClientMediaGallery: React.FC<ClientMediaGalleryProps> = ({ gameId, game, teams }) => {
  const [media, setMedia] = useState<MediaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaSubmission[]>([]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
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
      // Only show approved media in client view
      const approvedMedia = submissions.filter(s => s.status === 'approved');
      setMedia(approvedMedia);
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
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [presentationMode, selectedMedia]);

  // Presentation Mode View
  if (presentationMode && selectedMedia.length > 0) {
    const currentMedia = selectedMedia[currentSlideIndex];

    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <p className="font-bold">{currentMedia.teamName}</p>
              <p className="text-sm text-gray-400">{currentMedia.pointTitle}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white font-bold">
                {currentSlideIndex + 1} / {selectedMedia.length}
              </span>
              <button
                onClick={exitPresentation}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex-1 flex items-center justify-center p-4">
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

        {/* Footer - Thumbnails */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex gap-2 overflow-x-auto">
            {selectedMedia.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentSlideIndex ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                {m.mediaType === 'photo' ? (
                  <img src={m.mediaUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-purple-600 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
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
