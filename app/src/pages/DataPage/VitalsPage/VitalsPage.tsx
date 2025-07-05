import Header from '../Header.tsx';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PageContainer from '../../PageContainer.tsx';

export default function VitalsPage() {
  return (
    <PageContainer sx={{ mb: 15, gap: 1 }}>
      <Header title="Vitals" icon={<FavoriteIcon />} />
    </PageContainer>
  );
}
