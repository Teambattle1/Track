/**
 * VehicleSelector - Choose transport for the 80 Days journey
 * Victorian-styled vehicle selection with emoji icons
 */

import React from 'react';
import { Jorden80Vehicle } from '../../types';
import { VEHICLES } from '../../utils/jorden80/europeData';

interface VehicleSelectorProps {
  selectedVehicle: Jorden80Vehicle | undefined;
  onSelect: (vehicle: Jorden80Vehicle) => void;
  disabled?: boolean;
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  selectedVehicle,
  onSelect,
  disabled = false
}) => {
  return (
    <div className="space-y-4">
      <h3 className="j80-font-heading text-lg text-center" style={{ color: 'var(--j80-ink-brown)' }}>
        Vælg dit transportmiddel
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {VEHICLES.map((vehicle) => (
          <button
            key={vehicle.id}
            onClick={() => !disabled && onSelect(vehicle.id as Jorden80Vehicle)}
            disabled={disabled}
            className={`j80-vehicle-card ${selectedVehicle === vehicle.id ? 'selected' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="j80-vehicle-emoji">{vehicle.emoji}</div>
            <div className="j80-vehicle-name">{vehicle.name}</div>
            <div className="j80-vehicle-desc">{vehicle.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VehicleSelector;
