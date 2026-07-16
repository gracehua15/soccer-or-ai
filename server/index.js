import express from 'express';
import cors from 'cors';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    score INT NOT NULL,
    correct INT NOT NULL,
    ms INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const app = express();
app.use(cors({
  origin: [/^https:\/\/gracehua15\.github\.io$/, /^http:\/\/localhost(:\d+)?$/],
}));
app.use(express.json({ limit: '1kb' }));

const TOP = `
  SELECT name, score, correct, ms, extract(epoch from created_at) * 1000 AS at
  FROM scores
  ORDER BY score DESC, correct DESC, ms ASC, created_at ASC
  LIMIT 50
`;

app.get('/scores', async (_req, res) => {
  const { rows } = await pool.query(TOP);
  res.json(rows);
});

app.post('/scores', async (req, res) => {
  const { name, score, correct, ms } = req.body ?? {};
  const clean = String(name ?? 'Anonymous').trim().slice(0, 16) || 'Anonymous';
  if (
    !Number.isInteger(score) || score < 0 || score > 2000 ||
    !Number.isInteger(correct) || correct < 0 || correct > 10 ||
    !Number.isInteger(ms) || ms < 0 || ms > 120000 ||
    score > correct * 200
  ) {
    return res.status(400).json({ error: 'invalid score payload' });
  }
  const inserted = await pool.query(
    'INSERT INTO scores (name, score, correct, ms) VALUES ($1, $2, $3, $4) RETURNING extract(epoch from created_at) * 1000 AS at',
    [clean, score, correct, ms]
  );
  const { rows } = await pool.query(TOP);
  res.json({ at: Number(inserted.rows[0].at), board: rows });
});

app.get('/', (_req, res) => res.json({ ok: true, game: 'soccer-or-ai' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('leaderboard api on :' + port));
