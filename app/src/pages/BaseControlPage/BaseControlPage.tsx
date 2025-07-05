import BedIcon from '@mui/icons-material/Bed';
import HotelIcon from '@mui/icons-material/Hotel';
import WeekendIcon from '@mui/icons-material/Weekend';
import {
  Box,
  Button,
  Card,
  CardContent,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore';
import { useState } from 'react';
import PageContainer from '../PageContainer';

interface BasePosition {
	head: number;
	feet: number;
}

const presets = {
  flat: { head: 0, feet: 0 },
  sleep: { head: 10, feet: 5 },
  relax: { head: 30, feet: 15 },
};

export default function BaseControlPage() {
  const theme = useTheme();
  const { isUpdating } = useAppStore();
  const [position, setPosition] = useState<BasePosition>({ head: 0, feet: 0 });

  const handleHeadChange = (_: Event, newValue: number | number[]) => {
    setPosition((prev) => ({ ...prev, head: newValue as number }));
  };

  const handleFeetChange = (_: Event, newValue: number | number[]) => {
    setPosition((prev) => ({ ...prev, feet: newValue as number }));
  };

  const handlePresetClick = (preset: keyof typeof presets) => {
    setPosition(presets[preset]);
  };

  const applyPosition = async () => {
    // TODO: Implement API call to adjust base position
    console.log('Applying position:', position);
  };

  return (
    <PageContainer
      sx={ {
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
      } }
    >
      <Typography variant="h4" component="h1" gutterBottom align="center">
				Base Control
      </Typography>

      { /* Preset Buttons */ }
      <Stack direction="row" spacing={ 2 } sx={ { mb: 4 } }>
        <Button
          variant={
            position.head === presets.flat.head &&
						position.feet === presets.flat.feet
              ? 'contained'
              : 'outlined'
          }
          onClick={ () => handlePresetClick('flat') }
          disabled={ isUpdating }
          startIcon={ <BedIcon /> }
          fullWidth
        >
					Flat
        </Button>
        <Button
          variant={
            position.head === presets.sleep.head &&
						position.feet === presets.sleep.feet
              ? 'contained'
              : 'outlined'
          }
          onClick={ () => handlePresetClick('sleep') }
          disabled={ isUpdating }
          startIcon={ <HotelIcon /> }
          fullWidth
        >
					Sleep
        </Button>
        <Button
          variant={
            position.head === presets.relax.head &&
						position.feet === presets.relax.feet
              ? 'contained'
              : 'outlined'
          }
          onClick={ () => handlePresetClick('relax') }
          disabled={ isUpdating }
          startIcon={ <WeekendIcon /> }
          fullWidth
        >
					Relax
        </Button>
      </Stack>

      { /* Head Control */ }
      <Card sx={ { mb: 3 } }>
        <CardContent>
          <Typography variant="h6" gutterBottom>
						Head Height
          </Typography>
          <Box sx={ { px: 2, py: 3 } }>
            <Slider
              value={ position.head }
              onChange={ handleHeadChange }
              min={ 0 }
              max={ 45 }
              step={ 1 }
              marks={ [
                { value: 0, label: '0°' },
                { value: 15, label: '15°' },
                { value: 30, label: '30°' },
                { value: 45, label: '45°' },
              ] }
              valueLabelDisplay="on"
              valueLabelFormat={ (value) => `${value}°` }
              disabled={ isUpdating }
            />
          </Box>
        </CardContent>
      </Card>

      { /* Feet Control */ }
      <Card sx={ { mb: 3 } }>
        <CardContent>
          <Typography variant="h6" gutterBottom>
						Feet Height
          </Typography>
          <Box sx={ { px: 2, py: 3 } }>
            <Slider
              value={ position.feet }
              onChange={ handleFeetChange }
              min={ 0 }
              max={ 30 }
              step={ 1 }
              marks={ [
                { value: 0, label: '0°' },
                { value: 10, label: '10°' },
                { value: 20, label: '20°' },
                { value: 30, label: '30°' },
              ] }
              valueLabelDisplay="on"
              valueLabelFormat={ (value) => `${value}°` }
              disabled={ isUpdating }
            />
          </Box>
        </CardContent>
      </Card>

      { /* Apply Button */ }
      <Button
        variant="contained"
        onClick={ applyPosition }
        disabled={ isUpdating }
        size="large"
        fullWidth
        sx={ { mt: 2 } }
      >
				Apply Position
      </Button>
    </PageContainer>
  );
}
