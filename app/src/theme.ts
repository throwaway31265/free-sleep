import { PaletteMode, alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

const HEADING_WEIGHT = 500;
const DARK_THEME_BORDER = '#1E1E1E';
const LIGHT_THEME_BORDER = '#E0E0E0';
const DARK_APP_BAR = '#0B0B0B';

const typography = {
  fontFamily: 'poppins, Geist Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  allVariants: {
    fontSize: 15,
    letterSpacing: '0.05em',
  },
  h1: {
    fontSize: '3rem',
    fontWeight: HEADING_WEIGHT,
  },
  h2: {
    fontSize: '2.25rem',
    fontWeight: HEADING_WEIGHT,
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: HEADING_WEIGHT,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: HEADING_WEIGHT,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: HEADING_WEIGHT,
  },
  h6: {
    fontSize: '1rem',
    fontWeight: HEADING_WEIGHT,
  },
} satisfies ThemeOptions['typography'];

const getBorderColor = (mode: PaletteMode) => mode === 'dark' ? DARK_THEME_BORDER : LIGHT_THEME_BORDER;

const getFilledChipStyles = (
  theme: Theme,
  paletteKey: 'success' | 'info' | 'warning' | 'secondary'
) => {
  const paletteColor = theme.palette[paletteKey];
  const overlay = theme.palette.mode === 'light' ? 0.15 : 0.35;

  return {
    backgroundColor: alpha(paletteColor.main, overlay),
    color: theme.palette.mode === 'light'
      ? paletteColor.dark ?? paletteColor.main
      : paletteColor.light ?? paletteColor.contrastText ?? theme.palette.getContrastText(paletteColor.main),
    border: 'none',
  };
};

const buildComponents = (mode: PaletteMode) => {
  const borderColor = getBorderColor(mode);
  return {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${borderColor}`,
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: '0.9rem',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontSize: 16,
          borderColor: '1px solid red !important',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        input: {
          fontSize: 16,
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        input: {
          fontSize: 16,
        },
        underline: ({ theme }) => ({
          '&:before': {
            borderBottomColor: theme.palette.divider,
          },
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottomColor: `${borderColor} !important`,
          boxShadow: 'none',
          backgroundColor: mode === 'dark' ? DARK_APP_BAR : 'rgb(245, 245, 245)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
        },
        colorSuccess: ({ theme }) => getFilledChipStyles(theme, 'success'),
        colorInfo: ({ theme }) => getFilledChipStyles(theme, 'info'),
        colorWarning: ({ theme }) => getFilledChipStyles(theme, 'warning'),
        colorSecondary: ({ theme }) => getFilledChipStyles(theme, 'secondary'),
      },
    },
  } satisfies ThemeOptions['components'];
};

const buildPalette = (mode: PaletteMode): ThemeOptions['palette'] => ({
  mode,
  divider: getBorderColor(mode),
  background: mode === 'dark'
    ? {
      default: '#000000',
      paper: '#0A0A0A',
    }
    : {
      default: 'rgb(250, 250, 250)',
      paper: 'rgb(255, 255, 255)',
    },
});

export const buildTheme = (mode: PaletteMode = 'dark') =>
  createTheme({
    typography,
    palette: buildPalette(mode),
    shape: {
      borderRadius: 7,
    },
    components: buildComponents(mode),
  });

export const theme = buildTheme('dark');
