import express from 'express';
import serverStatus from '../../serverStatus.js';
const router = express.Router();
// Endpoint to list all log files as clickable links
router.get('/', async (req, res) => {
    res.json(serverStatus.toJSON());
});
export default router;
