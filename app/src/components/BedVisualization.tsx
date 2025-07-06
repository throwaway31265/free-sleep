import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

interface BedVisualizationProps {
  headPosition: number; // 0-45 degrees
  feetPosition: number; // 0-20 degrees (mapped from 0-30)
}

export default function BedVisualization({
  headPosition,
  feetPosition,
}: BedVisualizationProps) {
  const [headImageSrc, setHeadImageSrc] = useState('');
  const [feetImageSrc, setFeetImageSrc] = useState('');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [currentHeadPosition, setCurrentHeadPosition] = useState(0);
  const [currentFeetPosition, setCurrentFeetPosition] = useState(0);

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

  // Update positions directly when they change
  useEffect(() => {
    if (!imagesLoaded) return;

    const targetHeadPosition = Math.round(
      Math.max(0, Math.min(45, headPosition)),
    );
    const targetFeetPosition = Math.round(
      Math.max(0, Math.min(20, (feetPosition / 30) * 20)),
    );

    setCurrentHeadPosition(targetHeadPosition);
    setCurrentFeetPosition(targetFeetPosition);
  }, [headPosition, feetPosition, imagesLoaded]);

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
          width: '400px',
          height: '250px',
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
          <Typography variant="body2" sx={{ mb: 1, color: '#fff' }}>
            Loading bed visualization...
          </Typography>
          <Typography variant="caption" sx={{ color: '#888' }}>
            Preloading {46 + 21} images for smooth animation
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
