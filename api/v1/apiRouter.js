import { Router } from 'express';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);


export default apiRouter;