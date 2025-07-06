import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

interface BedVisualizationProps {
  headPosition: number; // 0-45 degrees
  feetPosition: number; // 0-20 degrees (mapped from 0-30)
}

export default function BedVisualization({ headPosition, feetPosition }: BedVisualizationProps) {
  const [headImageSrc, setHeadImageSrc] = useState('');
  const [feetImageSrc, setFeetImageSrc] = useState('');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [currentHeadPosition, setCurrentHeadPosition] = useState(0);
  const [currentFeetPosition, setCurrentFeetPosition] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Preload all images on component mount
  useEffect(() => {
    const preloadImages = async () => {
      const loadPromises: Promise<void>[] = [];

      // Preload head images (0-45)
      for (let i = 0; i <= 45; i++) {
        const padded = i.toString().padStart(2, '0');
        const promise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Still resolve on error to not block
          img.src = `/assets/bed/base-head_${padded}_Normal.png`;
        });
        loadPromises.push(promise);
      }

      // Preload feet images (0-20)
      for (let i = 0; i <= 20; i++) {
        const padded = i.toString().padStart(2, '0');
        const promise = new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Still resolve on error to not block
          img.src = `/assets/bed/base-legs_${padded}_Normal.png`;
        });
        loadPromises.push(promise);
      }

      // Wait for all images to load
      await Promise.all(loadPromises);
      setImagesLoaded(true);
    };

    preloadImages();
  }, []);

  // Animate positions smoothly when target changes
  useEffect(() => {
    if (!imagesLoaded) return;
    
    const targetHeadPosition = Math.round(Math.max(0, Math.min(45, headPosition)));
    const targetFeetPosition = Math.round(Math.max(0, Math.min(20, (feetPosition / 30) * 20)));
    
    // If positions are the same, no animation needed
    if (targetHeadPosition === currentHeadPosition && targetFeetPosition === currentFeetPosition) {
      return;
    }
    
    setIsAnimating(true);
    
    const animateToTarget = () => {
      const headDiff = targetHeadPosition - currentHeadPosition;
      const feetDiff = targetFeetPosition - currentFeetPosition;
      
      // Calculate steps (move 1 degree at a time)
      const headStep = headDiff > 0 ? 1 : headDiff < 0 ? -1 : 0;
      const feetStep = feetDiff > 0 ? 1 : feetDiff < 0 ? -1 : 0;
      
      // If we've reached the target, stop animating
      if (headStep === 0 && feetStep === 0) {
        setIsAnimating(false);
        return;
      }
      
      // Update current positions
      setCurrentHeadPosition(prev => prev + headStep);
      setCurrentFeetPosition(prev => prev + feetStep);
      
      // Continue animation after a short delay
      setTimeout(animateToTarget, 100); // 100ms between steps
    };
    
    animateToTarget();
  }, [headPosition, feetPosition, imagesLoaded, currentHeadPosition, currentFeetPosition]);

  // Update image sources when current positions change
  useEffect(() => {
    const headPadded = currentHeadPosition.toString().padStart(2, '0');
    setHeadImageSrc(`/assets/bed/base-head_${headPadded}_Normal.png`);
  }, [currentHeadPosition]);

  useEffect(() => {
    const feetPadded = currentFeetPosition.toString().padStart(2, '0');
    setFeetImageSrc(`/assets/bed/base-legs_${feetPadded}_Normal.png`);
  }, [currentFeetPosition]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '250px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
        backgroundColor: 'transparent',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Side by side bed sections */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Head section (left side) */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '50%',
            height: '100%',
            backgroundImage: `url(${headImageSrc})`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right center',
            zIndex: 2,
          }}
        />
        
        {/* Feet section (right side) */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '50%',
            height: '100%',
            backgroundImage: `url(${feetImageSrc})`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left center',
            zIndex: 1,
          }}
        />
      </Box>
      
      {/* Position indicators */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: 'primary.main',
          color: 'white',
          px: 1.5,
          py: 0.8,
          borderRadius: 1,
          fontSize: '0.875rem',
          fontWeight: 'medium',
          zIndex: 3,
          boxShadow: 1,
        }}
      >
        Head: {currentHeadPosition}°
      </Box>
      
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          backgroundColor: 'secondary.main',
          color: 'white',
          px: 1.5,
          py: 0.8,
          borderRadius: 1,
          fontSize: '0.875rem',
          fontWeight: 'medium',
          zIndex: 3,
          boxShadow: 1,
        }}
      >
        Feet: {Math.round((currentFeetPosition / 20) * 30)}°
      </Box>
      
      {/* Loading state overlay */}
      {!imagesLoaded ? (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Loading bed visualization...
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Preloading {46 + 21} images for smooth animation
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}