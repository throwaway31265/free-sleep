import React from 'react';
import * as Sentry from '@sentry/react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router';

import info from '../../server/src/serverInfo.json';
import { Settings } from '@api/settingsSchema';
import { DeviceStatus } from '@api/deviceStatusSchema';
import { USER_ID_KEY, HUB_VERSION_KEY, COVER_VERSION_KEY } from '@state/appStore.tsx';


export const initSentry = () => {
  if (import.meta.env.VITE_ENV === 'prod') {
    // For some reason, the build assets do not have access to VITE_ENV
    // eslint-disable-next-line no-console
    console.log('Initializing Sentry...');
    const initialScope = {
      user: {
        id: localStorage.getItem(USER_ID_KEY) || 'not_found',
      },
      tags: {
        ...info,
        environment: 'production',
        hub_version: localStorage.getItem(HUB_VERSION_KEY) || 'not_found',
        cover_version: localStorage.getItem(COVER_VERSION_KEY) || 'not_found',
      }
    };

    Sentry.init({
      dsn: 'https://ddadf73739b2b5dfa084cf8e2734c8a7@o4510246020710401.ingest.us.sentry.io/4510246033817600',
      integrations: [
        Sentry.reactRouterV7BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
      ],
      tracesSampleRate: 1.0,
      // Keep the previous data collection settings when upgrading to Sentry 11.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: {
          request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
          response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        },
        httpBodies: [],
        urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        graphQL: { document: false, variables: false },
      },
      traceLifecycle: 'static',
      sampleRate: 1,
      environment: 'production',
      release: info.version,
      initialScope: initialScope,
    });
  }
};

export const initSentryTags = (settings: Settings, deviceStatus: DeviceStatus) => {
  Sentry.setUser({ id: settings.id });
  Sentry.setTag('hub_version', deviceStatus.hubVersion);
  Sentry.setTag('cover_version', deviceStatus.coverVersion);
};


export const closeSentry = () => {
  // eslint-disable-next-line no-console
  console.log('Closing Sentry...');
  Sentry.close();
};
