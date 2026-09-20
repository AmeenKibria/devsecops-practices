const express = require('express');
const _ = require('lodash');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/items', (req, res) => {
  res.json({ items: ['crusher', 'grinding mill', 'pump', 'screen'] });
});

app.post('/echo', (req, res) => {
  const name = req.body.name;
  console.log('received payload: ' + JSON.stringify(req.body));
  res.send('<p>Hello, ' + name + '</p>');
});

app.listen(PORT, () => {
  console.log('listening on ' + PORT);
});
