import { createFileRoute } from '@tanstack/react-router'
import FavoriteIcon from '@mui/icons-material/Favorite';
import PageContainer from '@/components/shared/PageContainer.tsx';
import Header from '@/components/data/Header.tsx';

export const Route = createFileRoute('/data/vitals')({
  component: VitalsPage,
})

function VitalsPage() {
  return (
    <PageContainer sx={{ mb: 15, gap: 1 }}>
      <Header title="Vitals" icon={<FavoriteIcon />} />
    </PageContainer>
  );
}