import { PaletteMode, alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

// Night palette: a deep navy base with a soft indigo accent. Surfaces are solid translucent fills
// (no backdrop blur) so scrolling stays smooth on low-power phones.
const NIGHT = {
  background: '#070a12',
  surface: '#0f1422',
  surfaceRaised: '#151b2d',
  border: 'rgba(148, 163, 255, 0.10)',
  accent: '#8b9cff',
  accentStrong: '#6d7cff',
  text: '#e8ebf7',
  textMuted: '#8d94ad',
};

const DAY = {
  background: '#f5f6fb',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  border: 'rgba(30, 41, 99, 0.10)',
  accent: '#4f5fe0',
  accentStrong: '#3d4cd1',
  text: '#141a2e',
  textMuted: '#5d6480',
};

export const getSurfaceTokens = (mode: PaletteMode) => (mode === 'dark' ? NIGHT : DAY);

// System font stack: renders instantly on every phone with no font download.
const typography: ThemeOptions['typography'] = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  h1: { fontSize: '2.25rem', fontWeight: 650, letterSpacing: '-0.035em' },
  h2: { fontSize: '1.875rem', fontWeight: 650, letterSpacing: '-0.03em' },
  h3: { fontSize: '1.5rem', fontWeight: 650, letterSpacing: '-0.025em' },
  h4: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' },
  h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' },
  h6: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
  button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none', letterSpacing: '-0.005em' },
  caption: { fontSize: '0.75rem', lineHeight: 1.5 },
  overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', lineHeight: 2 },
};

const getChipStyles = (theme: Theme, paletteKey: 'success' | 'info' | 'warning' | 'secondary' | 'error') => ({
  backgroundColor: alpha(theme.palette[paletteKey].main, 0.12),
  color: theme.palette[paletteKey].main,
  border: `1px solid ${alpha(theme.palette[paletteKey].main, 0.22)}`,
});

// Shared styles give controls and surfaces a consistent appearance across every screen.
const buildComponents = (mode: PaletteMode): ThemeOptions['components'] => {
  const tokens = getSurfaceTokens(mode);
  return {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        html: { backgroundColor: tokens.background },
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          WebkitTapHighlightColor: 'transparent',
          fontVariantNumeric: 'tabular-nums',
        },
        '#root': { minHeight: '100dvh' },
        '::selection': { background: alpha(theme.palette.primary.main, 0.3) },
        ':focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 },
        '*': { scrollbarWidth: 'thin', scrollbarColor: `${theme.palette.divider} transparent` },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': { animation: 'none !important', transition: 'none !important' },
        },
      }),
    },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999, padding: '11px 20px', minHeight: 46,
          transition: 'background-color 150ms ease, border-color 150ms ease, transform 120ms ease',
          '&:active': { transform: 'scale(0.98)' },
        },
        outlined: ({ theme }) => ({
          borderColor: theme.palette.divider,
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.text.primary, 0.02),
          '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5), background: alpha(theme.palette.primary.main, 0.06) },
        }),
        contained: ({ theme }) => ({
          '&.MuiButton-colorPrimary': {
            backgroundColor: tokens.accentStrong,
            color: '#ffffff',
            boxShadow: `0 6px 20px -8px ${alpha(tokens.accentStrong, 0.8)}`,
            '&:hover': { backgroundColor: tokens.accent },
            '&.Mui-disabled': {
              backgroundColor: alpha(theme.palette.text.primary, 0.08), color: theme.palette.text.disabled, boxShadow: 'none',
            },
          },
        }),
        text: { borderRadius: 999 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 999, minWidth: 44, minHeight: 44 } } },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: alpha(tokens.surface, mode === 'dark' ? 0.86 : 1),
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 1px 2px rgba(20,26,46,0.04)',
        }),
        rounded: { borderRadius: 20 },
      },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 20 } } },
    MuiCardContent: { styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 24, backgroundColor: tokens.surfaceRaised },
      },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: tokens.surfaceRaised } } },
    MuiMenu: { styleOverrides: { paper: { backgroundColor: tokens.surfaceRaised, borderRadius: 14 } } },
    MuiPopover: { styleOverrides: { paper: { backgroundColor: tokens.surfaceRaised } } },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: 4, gap: 4, borderRadius: 999,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(tokens.surface, mode === 'dark' ? 0.7 : 1),
        }),
        grouped: { border: '0 !important', borderRadius: '999px !important', margin: '0 !important' },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: 'none', color: theme.palette.text.secondary, padding: '9px 16px', minHeight: 44, lineHeight: 1.5,
          fontWeight: 600, transition: 'background-color 150ms ease, color 150ms ease',
          '&.Mui-selected': {
            backgroundColor: alpha(tokens.accent, mode === 'dark' ? 0.16 : 0.12),
            color: theme.palette.text.primary,
            boxShadow: `inset 0 0 0 1px ${alpha(tokens.accent, 0.28)}`,
            '&:hover': { backgroundColor: alpha(tokens.accent, 0.22) },
          },
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: 3 },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontSize: 13, fontWeight: 600, minHeight: 44 } } },
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        // 16px font stops iOS Safari from zooming in when an input is focused
        root: { borderRadius: 12, fontSize: 16 },
        notchedOutline: ({ theme }) => ({ borderColor: theme.palette.divider }),
      },
    },
    MuiInput: {
      styleOverrides: {
        root: { fontSize: 16 },
        underline: ({ theme }) => ({ '&:before': { borderBottomColor: theme.palette.divider } }),
      },
    },
    MuiSelect: { styleOverrides: { select: { fontSize: 16 } } },
    MuiFormHelperText: { styleOverrides: { root: { fontSize: 12 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: ({ theme }) => ({ borderRadius: 999, opacity: 1, backgroundColor: alpha(theme.palette.text.primary, 0.16) }),
        thumb: { boxShadow: 'none' },
        switchBase: {
          '&.Mui-checked + .MuiSwitch-track': { opacity: 1, backgroundColor: tokens.accentStrong },
          '&.Mui-checked .MuiSwitch-thumb': { color: '#ffffff' },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { height: 6 },
        thumb: { width: 22, height: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', '&:before': { boxShadow: 'none' } },
        rail: { opacity: 0.25 },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: { borderRadius: '20px !important', overflow: 'hidden', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } },
      },
    },
    MuiAccordionSummary: { styleOverrides: { root: { minHeight: 60, padding: '0 20px' } } },
    MuiAccordionDetails: { styleOverrides: { root: { padding: '8px 20px 20px' } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 16, fontSize: 13, alignItems: 'center' },
        standard: ({ theme }) => ({
          '&.MuiAlert-colorWarning': {
            backgroundColor: alpha(theme.palette.warning.main, 0.08),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
          },
          '&.MuiAlert-colorInfo': {
            backgroundColor: alpha(theme.palette.info.main, 0.08),
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          },
          '&.MuiAlert-colorSuccess': {
            backgroundColor: alpha(theme.palette.success.main, 0.08),
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          },
          '&.MuiAlert-colorError': {
            backgroundColor: alpha(theme.palette.error.main, 0.08),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 26, borderRadius: 999, fontSize: 11.5, fontWeight: 600 },
        colorSuccess: ({ theme }) => getChipStyles(theme, 'success'),
        colorInfo: ({ theme }) => getChipStyles(theme, 'info'),
        colorWarning: ({ theme }) => getChipStyles(theme, 'warning'),
        colorSecondary: ({ theme }) => getChipStyles(theme, 'secondary'),
        colorError: ({ theme }) => getChipStyles(theme, 'error'),
      },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12, borderRadius: 8, backgroundColor: tokens.surfaceRaised, border: `1px solid ${tokens.border}` },
      },
    },
  };
};

export const buildTheme = (mode: PaletteMode = 'dark') => {
  const tokens = getSurfaceTokens(mode);
  return createTheme({
    typography,
    palette: {
      mode,
      primary: { main: tokens.accent, dark: tokens.accentStrong, contrastText: '#ffffff' },
      secondary: { main: mode === 'dark' ? '#a5acc6' : '#6b7290' },
      success: { main: mode === 'dark' ? '#5fd3a6' : '#16875f' },
      info: { main: mode === 'dark' ? '#7cc4ff' : '#2b74c7' },
      warning: { main: mode === 'dark' ? '#f2b866' : '#a86b12' },
      error: { main: mode === 'dark' ? '#ff7a85' : '#c93a4a' },
      divider: tokens.border,
      background: { default: tokens.background, paper: tokens.surface },
      text: { primary: tokens.text, secondary: tokens.textMuted },
      action: {
        hover: mode === 'dark' ? 'rgba(139,156,255,0.06)' : 'rgba(79,95,224,0.05)',
        selected: mode === 'dark' ? 'rgba(139,156,255,0.12)' : 'rgba(79,95,224,0.09)',
      },
    },
    shape: { borderRadius: 14 },
    components: buildComponents(mode),
  });
};

export const theme = buildTheme('dark');
