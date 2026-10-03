import { PropsWithChildren } from 'react';
import { Container, ContainerProps, SxProps, Theme } from '@mui/material';
import ErrorBoundary from '@components/ErrorBoundary.tsx';

type PageContainerProps = { containerProps?: ContainerProps; sx?: SxProps<Theme> };

export default function PageContainer({ children, sx = [], containerProps }: PropsWithChildren<PageContainerProps>) {
  return (
    <ErrorBoundary componentName="Page container">
      <Container
        { ...containerProps }
        id="PageContainer"
        maxWidth={ false }
        sx={ [
          { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2.5,
            width: '100%', maxWidth: 1000, mx: 'auto', px: { xs: 2.5, sm: 4, lg: 5 }, py: { xs: 3, md: 5 } },
          ...(Array.isArray(sx) ? sx : [sx]),
        ] }
      >
        { children }
      </Container>
    </ErrorBoundary>
  );
}
