import express, { json } from 'express';
import apiRouter  from './api/v1/apiRouter.js';

const app = express();

const PORT = process.env.PORT || 8080; // listening port


// parse body to json
app.use(json());
// 
app.use('/api/v1', apiRouter)


// Run Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
