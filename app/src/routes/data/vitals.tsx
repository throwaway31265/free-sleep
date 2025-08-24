import FavoriteIcon from '@mui/icons-material/Favorite';
import { createFileRoute } from '@tanstack/react-router';
import Header from '@/components/data/Header.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';

export const Route = createFileRoute('/data/vitals')({
  component: VitalsPage,
});

function VitalsPage() {
  return (
    <PageContainer sx={{ gap: 1 }}>
      <Header title="Vitals" icon={<FavoriteIcon />} />
    </PageContainer>
  );
}
