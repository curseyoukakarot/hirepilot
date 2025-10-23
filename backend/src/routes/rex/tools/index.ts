import { Router } from 'express';
import rexOpportunity from './opportunity';

export const rexTools = Router();
rexTools.use('/opportunity', rexOpportunity);

export default rexTools;


