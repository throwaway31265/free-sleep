import { useEffect, useState } from 'react';
import { Box, Slider, Typography } from '@mui/material';

type AutopilotSliderProps<T extends number | number[]> = {
  label: string;
  value: T;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  formatValue: (value: T) => string;
  onCommit: (value: T) => void;
};

/**
 * Labelled slider that keeps a local value while dragging and only saves on
 * commit (same pattern as LedBrightnessSlider), so each drag is one POST.
 */
export default function AutopilotSlider<T extends number | number[]>({
  label, value, min, max, step, disabled, formatValue, onCommit,
}: AutopilotSliderProps<T>) {
  const [draftValue, setDraftValue] = useState<T>(value);
  // Re-sync when the saved settings change (e.g. after refetch). Keyed by content so a
  // fresh range array from the parent on every render does not reset a drag in progress.
  const valueKey = JSON.stringify(value);
  useEffect(() => { setDraftValue(value); }, [valueKey]);

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
        <Typography variant="body2" sx={ { fontSize: 13, fontWeight: 500 } }>{ label }</Typography>
        <Typography variant="caption" sx={ { color: 'text.secondary', fontVariantNumeric: 'tabular-nums' } }>
          { formatValue(draftValue) }
        </Typography>
      </Box>
      <Slider
        aria-label={ label }
        getAriaValueText={ () => formatValue(draftValue) }
        value={ draftValue }
        onChange={ (_, newValue) => setDraftValue(newValue as T) }
        onChangeCommitted={ (_, newValue) => onCommit(newValue as T) }
        min={ min }
        max={ max }
        step={ step }
        disabled={ disabled }
        sx={ { width: 'calc(100% - 16px)', mx: 1 } }
      />
    </Box>
  );
}
