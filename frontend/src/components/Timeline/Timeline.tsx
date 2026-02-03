// Timeline Component
// OceanValue Animation Timeline Control

import React, { useState } from 'react';
import './Timeline.css';

const Timeline: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState('2023-01-01');
  const [startDate, setStartDate] = useState('2015-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    
    // TODO: Start/stop animation loop
    if (!isPlaying) {
      console.log('Starting timeline animation');
    } else {
      console.log('Pausing timeline animation');
    }
  };

  return (
    <div className="timeline-container">
      <div className="timeline-controls">
        <button className="timeline-btn" onClick={togglePlay}>
          {isPlaying ? '⏸ Pausa' : '▶ Play'}
        </button>

        <div className="timeline-info">
          <span className="date-label">Data Atual:</span>
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="date-input"
          />
        </div>

        <div className="timeline-range">
          <input 
            type="range" 
            min={startDate}
            max={endDate}
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="timeline-slider"
          />
        </div>

        <div className="timeline-dates">
          <span>{startDate}</span>
          <span>{endDate}</span>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
