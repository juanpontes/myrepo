const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database('data.db');

db.prepare(`CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id INTEGER,
  food_name TEXT NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY(food_id) REFERENCES foods(id)
)`).run();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/foods', (req, res) => {
  const foods = db.prepare('SELECT * FROM foods ORDER BY name').all();
  res.json(foods);
});

// foods with next available date based on 4-day rotation
app.get('/api/foods/next', (req, res) => {
  const foods = db
    .prepare(`
      SELECT f.id, f.name,
        COALESCE(date(MAX(e.date), '+4 days'), date('now')) AS next_available
      FROM foods f
      LEFT JOIN entries e ON f.id = e.food_id
      GROUP BY f.id
      ORDER BY f.name
    `)
    .all();
  res.json(foods);
});

// foods available today (not eaten in last 4 days)
app.get('/api/available', (req, res) => {
  const foods = db
    .prepare(`
      SELECT f.id, f.name
      FROM foods f
      LEFT JOIN (
        SELECT food_id, MAX(date) AS last_date
        FROM entries
        GROUP BY food_id
      ) e ON f.id = e.food_id
      WHERE e.last_date IS NULL OR date(e.last_date) <= date('now','-4 days')
      ORDER BY f.name
    `)
    .all();
  res.json(foods);
});

app.post('/api/foods', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const info = db.prepare('INSERT INTO foods (name) VALUES (?)').run(name.trim());
    res.json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (e) {
    res.status(400).json({ error: 'Food already exists' });
  }
});

app.put('/api/foods/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare('UPDATE foods SET name = ? WHERE id = ?').run(name.trim(), id);
    if (result.changes === 0) return res.sendStatus(404);
    db.prepare('UPDATE entries SET food_name = ? WHERE food_id = ?').run(name.trim(), id);
    res.json({ id, name: name.trim() });
  } catch (e) {
    res.status(400).json({ error: 'Food already exists' });
  }
});

app.delete('/api/foods/:id', (req, res) => {
  const { id } = req.params;
  const removeEntries = req.query.removeEntries === 'true';
  if (removeEntries) {
    db.prepare('DELETE FROM entries WHERE food_id = ?').run(id);
  } else {
    db.prepare('UPDATE entries SET food_id = NULL WHERE food_id = ?').run(id);
  }
  db.prepare('DELETE FROM foods WHERE id = ?').run(id);
  res.json({ id });
});

app.get('/api/entries', (req, res) => {
  const since = req.query.since;
  let entries;
  if (since) {
    entries = db
      .prepare('SELECT * FROM entries WHERE date >= ? ORDER BY date DESC')
      .all(since);
  } else {
    entries = db.prepare('SELECT * FROM entries ORDER BY date DESC').all();
  }
  res.json(entries);
});

app.post('/api/entries', (req, res) => {
  const { foodId, date, time } = req.body;
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId);
  if (!food) return res.status(400).json({ error: 'Food not found' });
  let when;
  if (date && time) {
    when = new Date(`${date}T${time}`);
  } else {
    when = new Date();
  }
  const iso = when.toISOString();
  const info = db
    .prepare('INSERT INTO entries (food_id, food_name, date) VALUES (?,?,?)')
    .run(foodId, food.name, iso);
  res.json({ id: info.lastInsertRowid, food_id: foodId, food_name: food.name, date: iso });
});

app.put('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Date and time required' });
  const when = new Date(`${date}T${time}`).toISOString();
  const result = db.prepare('UPDATE entries SET date = ? WHERE id = ?').run(when, id);
  if (result.changes === 0) return res.sendStatus(404);
  res.json({ id, date: when });
});

app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  res.json({ id });
});

app.get('/api/summary', (req, res) => {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 3);
  const sinceIso = sinceDate.toISOString().split('T')[0];
  const entries = db
    .prepare('SELECT * FROM entries WHERE date(date) >= date(?) ORDER BY date DESC')
    .all(sinceIso);
  const counts = {};
  entries.forEach((e) => {
    counts[e.food_name] = (counts[e.food_name] || 0) + 1;
  });
  const result = entries.map((e) => ({ ...e, repeated: counts[e.food_name] > 1 }));
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
