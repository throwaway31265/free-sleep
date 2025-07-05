import { Container, type ContainerProps, type SxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';

type PageContainerProps = {
  containerProps?: ContainerProps;
  sx?: SxProps;
};

export default function PageContainer({
  children,
  sx,
  containerProps,
}: React.PropsWithChildren<PageContainerProps>) {
  const theme = useTheme();

  return (
    <Container
      {...containerProps}
      id="PageContainer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        alignItems: 'center',
        gap: 2,
        margin: 0,
        justifyContent: 'center',
        [theme.breakpoints.up('sm')]: {
          width: '90%',
          padding: 0,
          paddingTop: 6,
          paddingBottom: 6,
          maxWidth: '700px',
        },
        [theme.breakpoints.down('sm')]: {
          width: '100%',
          padding: 1,
        },
        ...sx,
      }}
    >
      {children}
    </Container>
  );
}
