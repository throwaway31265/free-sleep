import FavoriteIcon from '@mui/icons-material/Favorite';
import PageContainer from '../../PageContainer.tsx';
import Header from '../Header.tsx';

export default function VitalsPage() {
  return (
    <PageContainer sx={{ mb: 15, gap: 1 }}>
      <Header title="Vitals" icon={<FavoriteIcon />} />
    </PageContainer>
  );
}
