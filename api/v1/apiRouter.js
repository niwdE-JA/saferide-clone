import { Router } from 'express';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';
import rideRouter from './routes/rideRouter.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/rides', rideRouter)


export default apiRouter;