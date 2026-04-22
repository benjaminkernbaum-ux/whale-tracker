const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🐋 WhaleVault v7.0 — Smart Money Intelligence`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📊 Ready\n`);
});
