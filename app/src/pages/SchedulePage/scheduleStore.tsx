import _ from 'lodash';
import { create } from 'zustand';
import { DailySchedule, DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { AccordionExpanded } from './SchedulePage.types.ts';
import { DaysSelected } from './SchedulePage.types.ts';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days';



type Validations = {
  endTimeIsValid: boolean;
  // TODO: Validate temperature adjustments
  // temperatureAdjustmentsValid: boolean,
};

export const DEFAULT_DAYS_SELECTED: DaysSelected = {
  sunday: false,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
};

const DEFAULT_VALIDATIONS: Validations = {
  endTimeIsValid: true,
  // temperatureAdjustmentsValid: true,
};

type ScheduleStore = {
  selectedDay: DayOfWeek;
  selectedDayIndex: number;
  selectDay: (selectedDayIndex: number) => void;
  reloadScheduleData: () => void;

  changesPresent: boolean,
  checkForChanges: () => void;
  setAccordionExpanded: (accordion: AccordionExpanded) => void;
  accordionExpanded: AccordionExpanded;


  validations: Validations;
  setValidations: (newValidations: DeepPartial<Validations>) => void;

  selectedSchedule: DailySchedule | undefined;
  updateSelectedSchedule: (dailySchedule: DeepPartial<DailySchedule>) => void;
  updateSelectedTemperatures: (temperatures: DailySchedule['temperatures']) => void;

  // Keep a copy of the original schedules
  originalSchedules: Schedules | undefined;
  setOriginalSchedules: (originalSchedules: Schedules) => void;

  selectedDays: Record<DayOfWeek, boolean>;
  toggleSelectedDay: (day: DayOfWeek) => void;
};

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  selectedDay: 'sunday',
  selectedDayIndex: 0,
  selectedSchedule: undefined,

  reloadScheduleData: () => {
    const { side } = useAppStore.getState();
    const { originalSchedules, selectedDay } = get();
    if (!originalSchedules) return;
    const selectedSchedule = originalSchedules[side][selectedDay];

    set({
      selectedDays: { ...DEFAULT_DAYS_SELECTED },
      accordionExpanded: undefined,
      validations: { ...DEFAULT_VALIDATIONS },
      selectedSchedule,
      changesPresent: false,
    });
  },

  selectDay: (newSelectedDayIndex) => {
    const { originalSchedules, reloadScheduleData } = get();
    if (!originalSchedules) return;
    const selectedDay = LOWERCASE_DAYS[newSelectedDayIndex];
    set({ selectedDay, selectedDayIndex: newSelectedDayIndex });
    reloadScheduleData();
  },

  accordionExpanded: undefined,
  setAccordionExpanded: (accordionExpanded) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    get().accordionExpanded === accordionExpanded ? set({ accordionExpanded: undefined }) : set({ accordionExpanded });
  },

  validations: {
    endTimeIsValid: true,
  },
  setValidations: (newValidations) => {
    const { validations } = get();
    set({ validations: _.merge(validations, newValidations) });
  },

  changesPresent: false,
  checkForChanges: () => {
    const { selectedDay, selectedSchedule, originalSchedules, selectedDays } = get();
    if (!originalSchedules) return;
    const { side } = useAppStore.getState();
    const changesPresent = !_.isEqual(originalSchedules[side][selectedDay], selectedSchedule) || _.some(selectedDays, value => value === true);

    set({ changesPresent });
  },

  // Updating schedules
  updateSelectedSchedule: (newSelectedSchedule) => {
    const { selectedSchedule, checkForChanges } = get();
    const selectedScheduleCopy = _.cloneDeep(selectedSchedule);
    _.merge(selectedScheduleCopy, newSelectedSchedule);

    set({ selectedSchedule: selectedScheduleCopy });
    checkForChanges();
  },
  // Updating schedules - (Temperatures) - needs to replace the entire temperatures field instead of merging it
  updateSelectedTemperatures: (temperatures) => {
    const { selectedSchedule, checkForChanges } = get();
    const selectedScheduleCopy = _.cloneDeep(selectedSchedule);
    if (!selectedSchedule) return;
    set({
      // @ts-ignore
      selectedSchedule: {
        ...selectedScheduleCopy,
        temperatures,
      },
    });
    checkForChanges();
  },

  selectedDays: { ...DEFAULT_DAYS_SELECTED },
  toggleSelectedDay: (day) => {
    const { selectedDays, checkForChanges } = get();
    set({
      selectedDays: {
        ...selectedDays,
        [day]: !selectedDays[day],
      }
    });
    checkForChanges();
  },

  originalSchedules: undefined,
  setOriginalSchedules: (originalSchedules) => {
    const { side } = useAppStore.getState();
    const { selectedDay } = get();
    const selectedSchedule = _.cloneDeep(originalSchedules[side][selectedDay]);

    set({ originalSchedules, selectedSchedule });
  },
}));
