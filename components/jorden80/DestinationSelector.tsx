/**
 * DestinationSelector - Choose next destination based on score
 * Shows available routes with star ratings based on correct answers
 */

import React, { useState } from 'react';
import { Jorden80City, Jorden80TeamProgress, Jorden80Config } from '../../types';
import { getNextDestinations, getRouteQuality, getMinimumScoreForDestination } from '../../utils/jorden80/routeNetwork';
import { getCity } from '../../utils/jorden80/europeData';
import { DEFAULT_JORDEN80_CONFIG } from '../../utils/jorden80/dayCalculation';
import { MapPin, Star, ArrowRight, Lock } from 'lucide-react';

interface DestinationSelectorProps {
  currentCity: string;
  correctAnswers: number;
  progress: Jorden80TeamProgress;
  config?: Jorden80Config;
  onSelectDestination: (cityId: string) => void;
  onCancel: () => void;
}

const DestinationSelector: React.FC<DestinationSelectorProps> = ({
  currentCity,
  correctAnswers,
  progress,
  config = DEFAULT_JORDEN80_CONFIG,
  onSelectDestination,
  onCancel
}) => {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const currentCityData = getCity(currentCity);
  const availableDestinations = getNextDestinations(currentCity, correctAnswers);
  const routeQuality = getRouteQuality(correctAnswers);

  // Get all possible destinations (with 3 correct) to show locked ones
  const allPossibleDestinations = getNextDestinations(currentCity, 3);

  const handleConfirm = () => {
    if (selectedCity) {
      onSelectDestination(selectedCity);
    }
  };

  const renderStars = (count: number, max: number = 3) => {
    return (
      <div className="j80-star-rating">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < count ? 'j80-star filled' : 'j80-star'}`}
            fill={i < count ? 'currentColor' : 'none'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="j80-destination-panel j80-animate-in">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="j80-font-heading text-2xl mb-2" style={{ color: 'var(--j80-ink-brown)' }}>
          Vælg Næste Destination
        </h2>
        <p className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
          Fra {currentCityData?.name} {currentCityData?.flagEmoji}
        </p>
      </div>

      {/* Score Summary */}
      <div
        className="flex items-center justify-between p-4 rounded-lg mb-6"
        style={{ backgroundColor: 'var(--j80-parchment)' }}
      >
        <div>
          <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
            Korrekte svar i {currentCityData?.name}
          </div>
          <div className="j80-font-heading text-xl" style={{ color: 'var(--j80-ink-brown)' }}>
            {correctAnswers} af 3
          </div>
        </div>
        <div className="text-right">
          <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
            Rutemuligheder
          </div>
          {renderStars(routeQuality.stars)}
        </div>
      </div>

      {/* Quality Description */}
      <div
        className="text-center p-3 rounded-lg mb-6"
        style={{
          backgroundColor: correctAnswers === 3
            ? 'rgba(74, 124, 89, 0.1)'
            : correctAnswers >= 2
            ? 'rgba(184, 134, 11, 0.1)'
            : 'rgba(155, 59, 59, 0.1)',
          borderLeft: `4px solid ${
            correctAnswers === 3
              ? 'var(--j80-success)'
              : correctAnswers >= 2
              ? 'var(--j80-warning)'
              : 'var(--j80-error)'
          }`
        }}
      >
        <span className="j80-font-heading" style={{ color: 'var(--j80-ink-brown)' }}>
          {routeQuality.label}:
        </span>{' '}
        <span className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
          {routeQuality.description}
        </span>
      </div>

      {/* Destination Options */}
      <div className="space-y-3 mb-6">
        {allPossibleDestinations.map((destId) => {
          const destCity = getCity(destId);
          if (!destCity) return null;

          const isAvailable = availableDestinations.includes(destId);
          const minimumScore = getMinimumScoreForDestination(currentCity, destId);
          const isSelected = selectedCity === destId;

          return (
            <button
              key={destId}
              onClick={() => isAvailable && setSelectedCity(destId)}
              disabled={!isAvailable}
              className={`j80-destination-option w-full ${isAvailable ? '' : 'disabled'} ${isSelected ? 'selected' : ''}`}
            >
              {/* City Flag & Name */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mr-4"
                style={{
                  backgroundColor: isAvailable ? 'var(--j80-gold)' : 'var(--j80-sepia-light)',
                  opacity: isAvailable ? 1 : 0.5
                }}
              >
                {isAvailable ? destCity.flagEmoji : <Lock className="w-5 h-5" />}
              </div>

              {/* City Info */}
              <div className="flex-1 text-left">
                <div className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
                  {destCity.name}
                </div>
                <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
                  {destCity.country}
                  {!isAvailable && minimumScore > 0 && (
                    <span className="ml-2">
                      (kræver {minimumScore} korrekte)
                    </span>
                  )}
                </div>
              </div>

              {/* Tier Indicator */}
              <div
                className="px-3 py-1 rounded-full text-sm j80-font-body"
                style={{
                  backgroundColor: destCity.tier === 5 ? 'var(--j80-gold)' : 'var(--j80-parchment-dark)',
                  color: 'var(--j80-ink-brown)'
                }}
              >
                {destCity.tier === 5 ? '🏁 Mål' : `Tier ${destCity.tier}`}
              </div>

              {/* Arrow */}
              {isAvailable && (
                <ArrowRight className="w-5 h-5 ml-3" style={{ color: 'var(--j80-sepia)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 j80-btn j80-btn-secondary">
          Tilbage
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedCity}
          className="flex-1 j80-btn j80-btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Rejse til {selectedCity ? getCity(selectedCity)?.name : '...'}
        </button>
      </div>

      {/* Travel Info */}
      {selectedCity && (
        <div className="mt-4 text-center j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
          Rejsen tager 1 dag
        </div>
      )}
    </div>
  );
};

export default DestinationSelector;
