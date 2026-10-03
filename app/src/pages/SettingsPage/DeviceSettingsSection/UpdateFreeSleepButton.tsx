import { Button, CircularProgress } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { useState, forwardRef, type ReactElement, type Ref } from 'react';
import currentServerInfo from '../../../../../server/src/serverInfo.json';

import { postJobs } from '@api/jobs.ts';
import { getLatestVersion, useServerInfo } from '@api/serverInfo.ts';
import { getDeviceStatus } from '@api/deviceStatus.ts';

// Hack for demo app
if (import.meta.env.VITE_ENV === 'demo') {
  currentServerInfo.version = '1.0.0';
}

const Transition = forwardRef(function Transition(
  props: TransitionProps & {
    children: ReactElement<any, any>;
  },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ ref } { ...props } />;
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// eslint-disable-next-line react/no-multi-comp
export default function UpdateFreeSleepButton() {
  const [open, setOpen] = useState(false);
  const { data: serverInfo } = useServerInfo();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateTitle, setUpdateTitle] = useState<undefined | string>();
  const [updateMessage, setUpdateMessage] = useState<undefined | string>();
  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const waitUntilReady = async () => {
    const latestVersionResp = await getLatestVersion();
    const latestVersion = latestVersionResp.data.version;
    await sleep(6_000);
    while (true) {
      try {
        const deviceStatus = await getDeviceStatus();
        if (deviceStatus.data.freeSleep.version !== latestVersion) {
          setUpdateTitle('Update failed- Reach out on Discord for help!');
          setUpdateMessage(`Latest version: ${latestVersion} -- Current version: ${deviceStatus.data.freeSleep.version}`);
        } else {
          setUpdateTitle('Update completed!');
          setUpdateMessage('Refreshing page...');
          await sleep(2_000);
          window.location.href = window.location.href.split('?')[0] + '?cachebuster=' + Date.now();
        }
        break;
      } catch (err) {
        console.warn('Device not ready yet, retrying getDeviceStatus in 1s...', err);
        await sleep(1_000);
      }
    }
  };

  const update = () => {
    setIsUpdating(true);
    postJobs(['update'])
      .then(() => {
        return waitUntilReady();
      })
      .catch(error => {
        console.error(error);
      });
  };

  return (
    <>
      <Button variant="outlined" onClick={ handleClickOpen } size="small" sx={ { width: '100%' } }>
        Update free sleep
      </Button>
      <Dialog
        open={ open }
        slots={ {
          transition: Transition,
        } }
        keepMounted
        onClose={ handleClose }
      >
        {
          updateTitle ?
            <DialogTitle>{ updateTitle }</DialogTitle>
            :
            isUpdating ?
              <DialogTitle>Updating Free Sleep...</DialogTitle>
              :
              <DialogTitle>Update Free Sleep?</DialogTitle>
        }

        <DialogContent>
          {
            updateMessage ?
              <DialogContentText>{ updateMessage }</DialogContentText>
              :
              isUpdating ?
                (
                  <>
                    <DialogContentText>
                      Updating from { currentServerInfo.version } to { serverInfo?.version }.
                      This page will be unavailable until update is complete.
                      &nbsp;<CircularProgress size={ 20 }/>
                    </DialogContentText>
                  </>
                )
                :
                (
                  <DialogContentText>
                    Update from { currentServerInfo.version } to { serverInfo?.version }?
                    This should take about 3 minutes.
                    This website will be unavailable during the update.
                  </DialogContentText>
                )
          }

        </DialogContent>
        {
          isUpdating ?
            (
              <DialogActions>
                <Button onClick={ handleClose }>Close</Button>
              </DialogActions>

            )
            :
            (
              <DialogActions>
                <Button onClick={ handleClose }>Cancel</Button>
                <Button onClick={ update }>Confirm</Button>
              </DialogActions>
            )
        }

      </Dialog>
    </>
  );
}
