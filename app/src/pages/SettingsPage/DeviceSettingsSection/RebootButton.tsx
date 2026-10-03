import { Button } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { useState, forwardRef, type ReactElement, type Ref } from 'react';

import { postJobs } from '@api/jobs.ts';


const Transition = forwardRef(function Transition(
  props: TransitionProps & {
    children: ReactElement<any, any>;
  },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ ref } { ...props } />;
});

// eslint-disable-next-line react/no-multi-comp
export default function RebootButton() {
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const reboot = () => {
    postJobs(['reboot'])
      .catch(error => {
        console.error(error);
      });
  };

  return (
    <>
      <Button variant="outlined" onClick={ handleClickOpen } size='small' sx={ { width: '100%' } }>
        Reboot pod now
      </Button>
      <Dialog
        open={ open }
        slots={ {
          transition: Transition,
        } }
        keepMounted
        onClose={ handleClose }
      >
        <DialogTitle>Reboot pod now?</DialogTitle>
        <DialogActions>
          <Button onClick={ handleClose }>Cancel</Button>
          <Button onClick={ reboot }>Confirm</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
