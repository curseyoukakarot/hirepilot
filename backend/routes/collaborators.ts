/**
 * Collaborators API routes
 * Handles adding/removing collaborators from job requisitions
 */

import { Router } from 'express';
import addCollaborator from '../api/collaborators/add';

const router = Router();

// Add collaborator to job requisition
router.post('/add', addCollaborator);

export default router;
