import {
  Box,
  Button,
  Card,
  CardContent,
  Typography, Chip
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { postSchedules } from '@api/schedules.ts';
import type { SideScheduleV2, Side } from '@api/schedulesSchema.ts';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from '@tanstack/react-router';

interface BasicScheduleListProps {
  sideSchedule: SideScheduleV2;
  onScheduleChanged: () => void;
}

export default function BasicScheduleList({
  sideSchedule,
  onScheduleChanged,
}: BasicScheduleListProps) {
  const navigate = useNavigate({ from: '/schedules' });
  const { side, setIsUpdating } = useAppStore();
  const { schedules, activeScheduleId } = sideSchedule;

  if (!schedules) {
    return null;
  }

  const scheduleEntries = Object.values(schedules);

  const handleSwitchSchedule = async (scheduleId: string) => {
    if (scheduleId === activeScheduleId) return;

    setIsUpdating(true);
    try {
      await postSchedules({
        operation: 'switchBasicSchedule',
        side: side as Side,
        scheduleId,
      });
      onScheduleChanged();
    } catch (error) {
      console.error('Failed to switch schedule:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditSchedule = (scheduleId: string) => {
    navigate({ to: '/schedules/$scheduleId', params: { scheduleId } });
  };

  const handleCreateNew = () => {
    navigate({ to: '/schedules/new' });
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: '600',
          }}
        >
          Your Schedules
        </Typography>
        <Button
          variant="contained"
          onClick={handleCreateNew}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: '#4CAF50',
            '&:hover': {
              backgroundColor: '#45a049',
            },
          }}
        >
          + Create New
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {scheduleEntries.length === 0 ? (
          <Card
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
            }}
          >
            <CardContent>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  textAlign: 'center',
                  py: 4,
                }}
              >
                No schedules yet. Create your first schedule to get started!
              </Typography>
            </CardContent>
          </Card>
        ) : (
          scheduleEntries.map((schedule) => {
            const isActive = schedule.id === activeScheduleId;
            return (
              <Card
                key={schedule.id}
                sx={{
                  backgroundColor: isActive
                    ? 'rgba(33, 150, 243, 0.1)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'rgba(33, 150, 243, 0.5)'
                    : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: '600',
                          }}
                        >
                          {schedule.name || 'Unnamed Schedule'}
                        </Typography>
                        {isActive && (
                          <Chip
                            icon={
                              <CheckCircleIcon
                                sx={{ fontSize: '16px', color: '#4CAF50' }}
                              />
                            }
                            label="Active"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(76, 175, 80, 0.2)',
                              color: '#4CAF50',
                              fontWeight: '600',
                              fontSize: '11px',
                              height: '24px',
                            }}
                          />
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: '12px',
                          }}
                        >
                          Bedtime: {schedule.data.power.on}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: '12px',
                          }}
                        >
                          Wake: {schedule.data.alarm.time}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!isActive && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSwitchSchedule(schedule.id)}
                            sx={{
                              borderRadius: '6px',
                              textTransform: 'none',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#2196F3',
                              '&:hover': {
                                backgroundColor: '#1976D2',
                              },
                            }}
                          >
                            Switch to This
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon sx={{ fontSize: '16px' }} />}
                          onClick={() => handleEditSchedule(schedule.id)}
                          sx={{
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'rgba(255, 255, 255, 0.8)',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            '&:hover': {
                              borderColor: 'rgba(255, 255, 255, 0.5)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            },
                          }}
                        >
                          Edit
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>
    </Box>
  );
}
