require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload dirs exist
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
['videos', 'images', 'ads'].forEach(d => {
  const dir = path.join(UPLOAD_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/fyp', require('./routes/fyp'));
app.use('/api/mainfeed', require('./routes/mainfeed'));
app.use('/api/discussions', require('./routes/discussions'));
app.use('/api/competitions', require('./routes/competitions'));
app.use('/api/coins', require('./routes/coins'));

// Hashtags search
app.get('/api/hashtags/search', (req, res) => {
  const db = require('./database/db');
  const { q = '' } = req.query;
  const results = db.prepare("SELECT * FROM hashtags WHERE name LIKE ? ORDER BY post_count DESC LIMIT 20").all(`${q}%`);
  res.json(results);
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Start cleanup jobs
const { startCleanupJob } = require('./jobs/cleanup');
startCleanupJob();

app.listen(PORT, () => {
  console.log(`TheBoard API running on port ${PORT}`);
});

module.exports = app;
