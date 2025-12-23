import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import track from './routes/track.js';
import identify from './routes/identify.js';

const app = new Hono();

// ============================================
// Middleware
// ============================================

// Logger
app.use('*', logger());

// Secure Headers
app.use('*', secureHeaders());

// CORS - Erlaubt Requests von allen Domains (für Tracking-Snippet)
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: false,
  })
);

// ============================================
// Health Check
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'Palacios Attribution Collector',
    version: '0.1.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// ============================================
// Routes
// ============================================

// Tracking Endpoints
app.route('/track', track);
app.route('/identify', identify);

// Webhook Placeholders (werden in Phase 2 implementiert)
app.post('/webhook/stripe', (c) => {
  return c.json({ message: 'Stripe webhook - coming soon' });
});

app.post('/webhook/customerio', (c) => {
  return c.json({ message: 'Customer.io webhook - coming soon' });
});

app.post('/webhook/digistore', (c) => {
  return c.json({ message: 'Digistore24 webhook - coming soon' });
});

app.post('/webhook/hubspot', (c) => {
  return c.json({ message: 'HubSpot webhook - coming soon' });
});

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: 'Internal server error',
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not found',
    },
    404
  );
});

// ============================================
// Start Server
// ============================================

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Palacios Collector starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Server running at http://localhost:${port}`);
