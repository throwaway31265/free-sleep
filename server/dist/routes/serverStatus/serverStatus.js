
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="bf0ec41d-55ab-5392-9cef-d9da57e5220d")}catch(e){}}();
import express from 'express';
import serverStatus from '../../serverStatus.js';
const router = express.Router();
// Endpoint to list all log files as clickable links
router.get('/', async (req, res) => {
    const response = await serverStatus.toJSON();
    res.json(response);
});
export default router;
//# sourceMappingURL=serverStatus.js.map
//# debugId=bf0ec41d-55ab-5392-9cef-d9da57e5220d
