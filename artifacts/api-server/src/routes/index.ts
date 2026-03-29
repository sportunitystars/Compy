import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import habitsRouter from "./habits";
import adminRouter from "./admin";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(habitsRouter);
router.use(adminRouter);
router.use(pushRouter);

export default router;
