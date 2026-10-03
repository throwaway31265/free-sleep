import { Outlet, useLocation, Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';

const DATA_PAGES = [
  { title: 'Sleep', route: '/data/sleep', icon: <BedOutlinedIcon/> },
  { title: 'Logs', route: '/data/logs', icon: <ArticleOutlinedIcon/> },
];

export default function DataPage() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/data/')) return <Outlet/>;

  return (
    <PageContainer sx={ { maxWidth: 760 } }>
      <PageHeader title="Data"/>
      { DATA_PAGES.map(({ title, route, icon }) => (
        <Paper
          key={ route }
          component={ Link }
          to={ route }
          sx={ {
            p: 2.5, display: 'flex', gap: 2, alignItems: 'center', color: 'inherit', textDecoration: 'none',
            '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
          } }
        >
          <Box sx={ { display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: 'action.selected' } }>
            { icon }
          </Box>
          <Box sx={ { flex: 1 } }>
            <Typography variant="h6" sx={ { mb: 0.5 } }>{ title }</Typography>
          </Box>
          <ArrowForwardIcon sx={ { fontSize: 18, color: 'text.secondary' } }/>
        </Paper>
      )) }
    </PageContainer>
  );
}
