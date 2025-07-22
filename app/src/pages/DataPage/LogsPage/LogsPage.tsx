import { baseURL } from '@api/api';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import PageContainer from '../../PageContainer.tsx';
import Header from '../Header.tsx';

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<string>('');
  const logsContainerRef = useRef(null);
  const logsEndRef = useRef(null);
  const isUserAtBottom = useRef(true);
  const theme = useTheme();

  // Fetch available log files
  useEffect(() => {
    const fetchLogFiles = async () => {
      try {
        const response = await axios.get<{ logs: string[] }>(
          `${baseURL}/api/logs`,
        );
        if (response.data.logs.length > 0) {
          setLogFiles(response.data.logs);
          setSelectedLog(response.data.logs[0]); // Default to the latest log file
        }
      } catch (error) {
        console.error('Error fetching log files:', error);
      }
    };

    fetchLogFiles();
  }, []);

  // Subscribe to log updates for the selected file
  useEffect(() => {
    if (!selectedLog) return;

    const eventSource = new EventSource(`${baseURL}/api/logs/${selectedLog}`);

    eventSource.onmessage = (event) => {
      const logData = JSON.parse(event.data);
      setLogs((prevLogs) => [...prevLogs.slice(-999), logData.message]); // Keep last 1000 logs
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedLog]); // Re-run when log file changes

  // Track if user is at the bottom
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    isUserAtBottom.current = scrollHeight - scrollTop <= clientHeight + 50; // 50px buffer
  };

  // Auto-scroll only if user is at the bottom
  useEffect(() => {
    if (isUserAtBottom.current) {
      // @ts-ignore
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  return (
    <PageContainer
      sx={{
        // height: '100%',
        // maxHeight: '100%',
        [theme.breakpoints.up('sm')]: {
          width: '95%',
          padding: 0,
          paddingTop: 6,
          paddingBottom: 6,
          maxWidth: '100%',
          height: '100%',
        },
      }}
    >
      <Header title="Logs" icon={<TextSnippetIcon />} />

      <Paper
        elevation={3}
        sx={{
          // height: '100%',
          // maxHeight: '100%',
          p: 2,
          // mt: 2,
          bgcolor: theme.palette.background.paper,
          color: '#fff',
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          [theme.breakpoints.up('sm')]: {
            width: '100%',
          },
        }}
      >
        <FormControl sx={{ minWidth: 200, mb: 1 }}>
          <InputLabel sx={{ color: theme.palette.grey[100] }}>
            Log file
          </InputLabel>
          <Select
            value={selectedLog}
            onChange={(e) => {
              setLogs([]);
              setSelectedLog(e.target.value);
            }}
          >
            {logFiles.map((file) => (
              <MenuItem key={file} value={file}>
                {file}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            color: theme.palette.grey[100],
            pb: 1,
            borderBottom: `1px solid ${theme.palette.grey[700]}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            paddingBottom: 1,
          }}
        >
          Live Server Logs
        </Typography>

        <Box
          ref={logsContainerRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: `${window.innerHeight - 300}px`,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            p: 1,
            '&::-webkit-scrollbar': {
              width: '10px',
            },
            '&::-webkit-scrollbar-track': {
              background: theme.palette.background.paper,
              borderRadius: '5px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.grey[600],
              borderRadius: '5px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.grey[500],
            },
          }}
        >
          <Typography
            sx={{
              fontFamily: 'monospace',
              color: theme.palette.grey[200],
              fontSize: '12px',
            }}
          >
            {logs.join('\n')}
          </Typography>
          <div ref={logsEndRef} />
        </Box>
      </Paper>
    </PageContainer>
  );
}
