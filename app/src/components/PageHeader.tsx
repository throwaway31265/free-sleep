import { Box, Typography } from '@mui/material';

type PageHeaderProps = { title: string };

export default function PageHeader({ title }: PageHeaderProps) {
  return (
    <Box sx={ { width: '100%', mb: 0.5 } }>
      <Typography variant="h2" component="h1" sx={ { fontSize: { xs: 27, md: 30 } } }>{ title }</Typography>
    </Box>
  );
}
