/* eslint-disable max-len */
import React, { useState } from 'react';
import { Modal, Box, Typography, Button } from '@mui/material';

const LicenseModal: React.FC = () => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div>
      { /* Button to Open Modal */ }
      <Button variant="contained" onClick={ handleOpen }>
        View License and Disclaimer
      </Button>

      { /* Modal Component */ }
      <Modal
        open={ open }
        onClose={ handleClose }
        aria-labelledby="license-modal-title"
        aria-describedby="license-modal-description"
      >
        <Box
          sx={ {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxHeight: '80vh',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            overflowY: 'auto',
            borderRadius: '8px',
          } }
        >
          { /* Modal Content */ }
          <Typography id="license-modal-title" variant="h6" component="h2" gutterBottom>
            Open Source Disclaimer and License Agreement
          </Typography>
          <Typography
            id="license-modal-description"
            component="pre"
            sx={ {
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              overflowY: 'auto',
              maxHeight: '60vh',
              lineHeight: '1.6',
            } }
          >
            { `**Last Updated:** January 2, 2025

**1. No Affiliation or Endorsement**
This App is not affiliated with, authorized, endorsed, or supported by 8 Sleep, Inc. ("8 Sleep"). Use of this App may void your Device's warranty or violate 8 Sleep's terms of service.

**2. Open Source Nature**
This App is provided as open-source software under the MIT License. You are free to access, modify, and distribute the source code as permitted under the MIT License.

**3. Use at Your Own Risk**
This App is provided "AS IS" and "WITH ALL FAULTS." By using this App, you accept all risks associated with its use, including but not limited to:
- Malfunctions or disruptions to your Device.
- Loss of data, settings, or functionality on your Device.
- Violations of applicable laws or terms of service.

The developers of this App disclaim all warranties, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.

**4. Limited Scope of Operation**
This App is designed to function solely on a local network (LAN). The developers do not provide any remote management capabilities or support for cloud-based operation.

**5. No Liability**
Under no circumstances shall the developers or contributors of this App be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising out of or in connection with the use of this App. This includes, but is not limited to, damages for loss of profits, data, or goodwill, or other intangible losses.

**6. Compliance with Laws**
You are solely responsible for ensuring that your use of this App complies with all applicable laws, regulations, and third-party agreements.

**7. No Remote Control**
This App operates solely within a local network and cannot be remotely disabled or controlled by the developers. You are fully responsible for its setup, management, and operation within your LAN environment.

**8. Acknowledgment**
By using this App, you acknowledge that:
- You understand the risks involved with using a jailbroken application.
- You assume full responsibility for any consequences resulting from its use.
- You release the developers and contributors of this App from any liability arising from your use of the App.

**License**
This App is licensed under the MIT License. You are free to use, modify, and distribute the software as allowed under the terms of this license.

MIT License

Copyright (c) 2025 Your Name or Project Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.` }
          </Typography>
          <Button
            variant="outlined"
            onClick={ handleClose }
            sx={ { mt: 2 } }
          >
            Close
          </Button>
        </Box>
      </Modal>
    </div>
  );
};

export default LicenseModal;
