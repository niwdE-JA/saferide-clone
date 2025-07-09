const express = require('express');

const app = express();
const apiRouter = express.Router()

const PORT = process.env.PORT || 3000; // listening port


// parse body to json
app.use(express.json());
// 
app.use('/api', apiRouter)


apiRouter.get('/', (req, res) => {
  // Send a simple text response
  res.send('Hello, World! Welcome to your Express backend!');
});

apiRouter.get('/login', (req, res) => {
  // Send a JSON response
  res.json({
    message: 'This is some data from your API!',
    timestamp: new Date().toISOString(),
    items: ['item1', 'item2', 'item3']
  });
});


// Run Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

