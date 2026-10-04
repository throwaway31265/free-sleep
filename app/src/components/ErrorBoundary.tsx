import { PropsWithChildren, useState } from 'react';
import * as Sentry from '@sentry/react';
import { Alert, Typography } from '@mui/material';


type ErrorInfo = {
  error: Error;
  componentStack: string;
  eventId: string;
}

type ErrorMessageProps = {
  componentName: string;
  errorInfo?: ErrorInfo;
}


const ErrorMessage = ({ componentName, errorInfo }: ErrorMessageProps) => {
  if (errorInfo && import.meta.env.VITE_ENV === 'dev') {
    const errorMessage =
      errorInfo?.error instanceof Error
        ? errorInfo.error.message
        : typeof errorInfo?.error === 'string'
          ? errorInfo.error
          : '';

    return (
      <Alert severity='error'>

        <Typography sx={ { color: 'text.secondary', fontFamily: 'monospace' } }>
          ERROR: &nbsp;
          { errorMessage }
          <br />
          { errorInfo.componentStack }
        </Typography>
      </Alert>
    );
  } else {
    return (
      <Alert severity='error'>
        { componentName } failed to load
      </Alert>
    );
  }
};

type ErrorBoundaryProps = PropsWithChildren<Pick<ErrorMessageProps, 'componentName'>>;

// eslint-disable-next-line react/no-multi-comp
export default function ErrorBoundary({ children, componentName }: ErrorBoundaryProps) {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | undefined>();

  return (
    <Sentry.ErrorBoundary
      fallback={ <ErrorMessage componentName={ componentName } errorInfo={ errorInfo }/> }
      // @ts-expect-error
      onError={ (error, componentStack, eventId) => setErrorInfo({ error, componentStack, eventId }) }
    >
      { children }
    </Sentry.ErrorBoundary>
  );
}
