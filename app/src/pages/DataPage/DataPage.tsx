import {
  Outlet,
  useLocation,
  useNavigate
} from 'react-router-dom';
import PageContainer from '../PageContainer.tsx';


import Divider from '@mui/material/Divider';

import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import BedIcon from '@mui/icons-material/Bed';
import { List, ListItem } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const SettingsList = () => {
  const navigate = useNavigate();

  return (
    <List sx={ { width: '100%', maxWidth: 360, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 2 } }>
      { /* Header */ }
      <Typography variant="h6" sx={ { p: 2, fontWeight: 'bold' } }>
        Data
      </Typography>

      <Divider/>

      { /* Sleep */ }
      <ListItem onClick={ () => navigate('/data/sleep') }>
        <ListItemIcon>
          <BedIcon/>
        </ListItemIcon>
        <ListItemText primary="Sleep"/>
        <ArrowForwardIosIcon fontSize="small" sx={ { color: 'gray' } }/>
      </ListItem>
    </List>
  );
};


// eslint-disable-next-line react/no-multi-comp
export default function DataPage() {
  const location = useLocation();

  // Check if we are on a child route of dashboard (like stats)
  const hideContent = location.pathname.startsWith('/data/');

  return (
    <PageContainer sx={ { mt: 2 } }>
      {
        !hideContent && (
          <SettingsList/>
        )
      }

      <Outlet/>
    </PageContainer>
  );
}
