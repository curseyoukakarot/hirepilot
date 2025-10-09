import { Router } from "express";
import { verifyAgentToken } from "../../middleware/verifyAgentToken";
import lookupUser from "./lookupUser";
import notify from "./notify";
import tickets from "./tickets";

const router = Router();

router.use(verifyAgentToken);
router.use(lookupUser);
router.use(notify);
router.use(tickets);

export default router;


