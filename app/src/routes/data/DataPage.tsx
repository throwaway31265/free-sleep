import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BedIcon from '@mui/icons-material/Bed';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { List, ListItem } from '@mui/material';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
// import FavoriteIcon from '@mui/icons-material/Favorite';
import Typography from '@mui/material/Typography';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import PageContainer from '@/components/shared/PageContainer.tsx';

const SettingsList = () => {
  const navigate = useNavigate();

  return (
    <List
      sx={{
        width: '100%',
        maxWidth: 360,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 2,
      }}
    >
      {/* Header */}
      <Typography variant="h6" sx={{ p: 2, fontWeight: 'bold' }}>
        Data
      </Typography>

      <Divider />

      {/* Sleep */}
      <ListItem onClick={() => navigate({ to: '/data/sleep' })}>
        <ListItemIcon>
          <BedIcon />
        </ListItemIcon>
        <ListItemText primary="Sleep" />
        <ArrowForwardIosIcon fontSize="small" sx={{ color: 'gray' }} />
      </ListItem>
      <ListItem onClick={() => navigate({ to: '/data/logs' })}>
        <ListItemIcon>
          <TextSnippetIcon />
        </ListItemIcon>
        <ListItemText primary="Logs" />
        <ArrowForwardIosIcon fontSize="small" sx={{ color: 'gray' }} />
      </ListItem>
      {/*<ListItem onClick={ () => navigate({ to: '/data/vitals' }) }>*/}
      {/*  <ListItemIcon>*/}
      {/*    <FavoriteIcon/>*/}
      {/*  </ListItemIcon>*/}
      {/*  <ListItemText primary="Vitals"/>*/}
      {/*  <ArrowForwardIosIcon fontSize="small" sx={ { color: 'gray' } }/>*/}
      {/*</ListItem>*/}
    </List>
  );
};

// eslint-disable-next-line react/no-multi-comp
export default function DataPage() {
  const location = useLocation();
  // Check if we are on a child route of dashboard (like stats)
  const hideContent = location.pathname.startsWith('/data/');
  if (!hideContent) {
    return (
      <PageContainer sx={{ mt: 2 }}>
        <SettingsList />
      </PageContainer>
    );
  }
  return <Outlet />;
}
