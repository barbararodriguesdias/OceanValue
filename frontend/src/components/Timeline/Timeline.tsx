export { default } from './TimelineControl';
/*
// Timeline Component
// OceanValue Animation Timeline Control

import React, { useState, useEffect } from 'react';
import './Timeline.css';

interface TimelineProps {
  startDate: string;
  endDate: string;
  varMin?: number;
  varMax?: number;
  varUnit?: string;
  riskType?: string;
  onTimeChange?: (time: string) => void;
  stepDays?: number;
}

const Timeline: React.FC<TimelineProps> = ({
  startDate,
  endDate,
  varMin = 0,
  varMax = 100,
  varUnit = '',
  riskType = 'wind',
  onTimeChange,
  stepDays = 1,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(`${startDate}T00:00:00`));
  const [currentTime, setCurrentTime] = useState('00:00');

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
    setCurrentStep(0);
    const resetDate = new Date(`${startDate}T00:00:00`);
    setCurrentDate(resetDate);
    setCurrentTime('00:00');
    onTimeChange?.(formatDate(resetDate));
  const totalSteps = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay / stepDays));

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  // Get unit based on risk type
  const getUnit = () => {
    const units: Record<string, string> = {
      wind: 'm/s',
      wave: 'm',
      current: 'm/s',
      temperature: '°C',
      flood: 'm',
      heatwave: 'dias'
    };
    return varUnit || units[riskType] || '';
  };

  // Generate gradient colors (now returns a single brand color)
  const generateGradient = () => {
    return 'var(--brand-vibrant)';
  };

  // Update current date when props change
  useEffect(() => {
    setCurrentStep(0);
    const resetDate = new Date(`${startDate}T00:00:00`);
    setCurrentDate(resetDate);
    setCurrentTime('00:00');
    onTimeChange?.(formatDate(resetDate));
  }, [startDate]);

  useEffect(() => {
    const next = new Date(start);
    next.setDate(start.getDate() + currentStep * stepDays);
    setCurrentDate(next);
    setCurrentTime('00:00');
    onTimeChange?.(formatDate(next));
  }, [currentStep, startDate, stepDays]);

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, totalSteps]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="timeline-container">
      <div className="timeline-controls">
        <div className="timeline-left">
          <button className="timeline-btn play-btn" onClick={togglePlay}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          <div className="timeline-info">
            <span className="date-time-display">
              {formatDate(currentDate)} {currentTime}
            </span>
          </div>

          <div className="timeline-range">
            <span className="range-label start">{startDate}</span>
            <input
              type="range"
              min="0"
              max={totalSteps}
              value={currentStep}
              onChange={(e) => {
                setCurrentStep(Number(e.target.value));
              }}
              className="timeline-slider"
            />
            <span className="range-label end">{endDate}</span>
          </div>
        </div>

        <div className="timeline-right">
          <div className="heatmap-legend">
            <div className="legend-header">Legenda</div>
            <div className="legend-gradient" style={{ background: generateGradient() }}></div>
            <div className="legend-labels">
              <span className="legend-min">{varMin.toFixed(1)} {getUnit()}</span>
              <span className="legend-max">{varMax.toFixed(1)} {getUnit()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

*/
