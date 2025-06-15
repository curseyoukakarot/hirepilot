import { Router } from 'express';
import { sendMessage, getAllMessages, getUnreadCount } from '../controllers/messageController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/send', requireAuth, sendMessage);
router.get('/all', requireAuth, getAllMessages);
router.get('/unread-count', requireAuth, getUnreadCount);

export default router; 