import { Router } from 'express';
import authRouter from './routes/authRouter.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);


export default apiRouter;