import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3001);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

const statuses = new Set(['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered']);
const clients = new Set();

async function initialise() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      customer_name VARCHAR(80) NOT NULL,
      restaurant VARCHAR(120) NOT NULL,
      items JSONB NOT NULL,
      food_subtotal NUMERIC(12,2) NOT NULL,
      delivery_fee NUMERIC(12,2) NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      restaurant_payout NUMERIC(12,2) NOT NULL,
      driver_payout NUMERIC(12,2) NOT NULL,
      nahalabs_revenue NUMERIC(12,2) NOT NULL,
      address VARCHAR(250) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'placed',
      driver_name VARCHAR(80),
      created_at BIGINT NOT NULL
    )
  `);
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function allocate(food, delivery) {
  const restaurant = money(food * 0.92);
  const nahaLabs = money(food * 0.08 + Math.min(3, delivery));
  const driver = money(delivery - Math.min(3, delivery));
  return { restaurant, driver, nahaLabs };
}
function mapOrder(row) {
  return {
    id: String(row.id),
    customerName: row.customer_name,
    restaurant: row.restaurant,
    items: row.items,
    foodSubtotal: Number(row.food_subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    restaurantPayout: Number(row.restaurant_payout),
    driverPayout: Number(row.driver_payout),
    nahaLabsRevenue: Number(row.nahalabs_revenue),
    address: row.address,
    status: row.status,
    ...(row.driver_name ? { driverName: row.driver_name } : {}),
    createdAt: Number(row.created_at),
  };
}
function publish(order) {
  const message = `data: ${JSON.stringify(order)}\\n\\n`;
  for (const client of clients) client.write(message);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'flavourly-api' }));
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(': connected\\n\\n');
  clients.add(res);
  const heartbeat = setInterval(() => res.write(': heartbeat\\n\\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
});

app.get('/api/orders', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
    res.json({ orders: rows.map(mapOrder) });
  } catch (error) { next(error); }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const input = req.body || {};
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50 ||
        !String(input.address || '').trim() || !String(input.restaurant || '').trim()) {
      return res.status(400).json({ error: 'A basket, restaurant and delivery address are required' });
    }
    const items = input.items.map(item => ({
      name: String(item.name || '').trim().slice(0, 100),
      qty: Math.max(1, Math.min(50, Math.floor(Number(item.qty) || 1))),
      price: money(Number(item.price)),
    }));
    if (items.some(item => !item.name || !Number.isFinite(item.price) || item.price <= 0)) {
      return res.status(400).json({ error: 'Basket items are invalid' });
    }
    const foodSubtotal = money(items.reduce((sum, item) => sum + item.qty * item.price, 0));
    const deliveryFee = money(Number(input.deliveryFee));
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 500) {
      return res.status(400).json({ error: 'Delivery fee is invalid' });
    }
    const parts = allocate(foodSubtotal, deliveryFee);
    const total = money(foodSubtotal + deliveryFee);
    const createdAt = Date.now();
    const values = [
      String(input.customerName || 'Guest').trim().slice(0, 80) || 'Guest',
      String(input.restaurant).trim().slice(0, 120),
      JSON.stringify(items), foodSubtotal, deliveryFee, total,
      parts.restaurant, parts.driver, parts.nahaLabs,
      String(input.address).trim().slice(0, 250), createdAt,
    ];
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_name, restaurant, items, food_subtotal, delivery_fee, total, restaurant_payout, driver_payout, nahalabs_revenue, address, created_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      values,
    );
    const order = mapOrder(rows[0]);
    publish(order);
    res.status(201).json({ order });
  } catch (error) { next(error); }
});

app.put('/api/orders/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, driverName } = req.body || {};
    if (!Number.isSafeInteger(id) || id <= 0 || !statuses.has(status)) {
      return res.status(400).json({ error: 'Order ID or status is invalid' });
    }
    const { rows } = await pool.query(
      `UPDATE orders SET status=$1, driver_name=COALESCE($2, driver_name) WHERE id=$3 RETURNING *`,
      [status, driverName ? String(driverName).slice(0, 80) : null, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = mapOrder(rows[0]);
    publish(order);
    res.json({ order });
  } catch (error) { next(error); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error' });
});

const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(here, '../dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve(here, '../dist/index.html')));

await initialise();
const server = app.listen(port, '0.0.0.0', () => console.log(`Flavourly API listening on ${port}`));
async function shutdown() {
  server.close();
  for (const client of clients) client.end();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
