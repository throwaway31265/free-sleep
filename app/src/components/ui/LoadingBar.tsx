import { Box, useTheme } from "@mui/material";

interface LoadingBarProps {
  isUpdating: boolean;
}

/**
 * splays a gradient animation at the top of the screen when data is being updated.
 */
export const LoadingBar = ({ isUpdating }: LoadingBarProps) => {
  const theme = useTheme();

  const gradient = `linear-gradient(
    90deg,
    transparent,
    ${theme.palette.primary.dark},
    transparent,
    ${theme.palette.primary.dark},
    transparent
  )`;

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: isUpdating ? gradient : 'transparent',
          backgroundSize: '200% 100%',
          animation: isUpdating
            ? 'slide-gradient 10s linear infinite reverse'
            : 'none',
          zIndex: 1201,
        }}
      />
    </>
  );
};