import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import { Side, useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';


export default function SideControl() {
  const { isUpdating, side, setSide } = useAppStore();
  const { reloadScheduleData } = useScheduleStore();
  const handleSelectSide = (side: Side) => {
    setSide(side);
    reloadScheduleData();
  };
  return (
    <ButtonGroup variant="contained">
      <Button
        variant={ side === 'left' ? 'contained' : 'outlined' }
        onClick={ () => handleSelectSide('left') }
        disabled={ isUpdating }
      >
        Left Side
      </Button>
      <Button
        variant={ side === 'right' ? 'contained' : 'outlined' }
        onClick={ () => handleSelectSide('right') }
        disabled={ isUpdating }
      >
        Right Side
      </Button>
    </ButtonGroup>
  );
}
