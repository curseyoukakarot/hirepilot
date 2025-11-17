import { Router } from "express";
import { verifyAgentToken } from "../../middleware/verifyAgentToken";
import mcpManifest from "./mcpManifest";
import lookupUser from "./lookupUser";
import notify from "./notify";
import tickets from "./tickets";
import checks from "./checks";
import walkthroughs from "./walkthroughs";
import account from "./account";
import feedback from "./feedback";
import sales from "./sales";
import searchKnowledge from "./searchKnowledge";
import openapi from "./openapi";

const router = Router();

// Manifest is public for discovery
router.use(mcpManifest);
// Also expose OpenAPI + ai-plugin.json for compatibility with some UIs
router.use(openapi);

// Tools require agent token
router.use(verifyAgentToken);
router.use(lookupUser);
router.use(notify);
router.use(tickets);
router.use(checks);
router.use(walkthroughs);
router.use(account);
router.use(feedback);
router.use(sales);
router.use(searchKnowledge);

export default router;


