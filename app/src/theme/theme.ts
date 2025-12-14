import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#010101',
    },
    grey: {
      100: '#e8eaed',
      300: '#a6adbe',
      400: '#88878c',
      500: '#606060',
      700: '#272727',
      800: '#262626',
      900: '#242424',
    },
  },
});

