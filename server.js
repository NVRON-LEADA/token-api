import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import dotenv from 'dotenv';

import Clinic from './models/Clinic.js';

import authRoutes from './routes/auth.js';
import tokensRoutes from './routes/tokens.js';
import queueRoutes from './routes/queue.js';
import clinicRoutes from './api/routes/clinicRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (adjust to your domains)
const allowedOrigins = [
  /^https:\/\/.*\.leada-client\.onrender\.com$/,
  // add more origins here if needed
];

// CORS middleware with dynamic origin check
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// JSON parsing middleware
app.use(express.json());

// Extract subdomain middleware (e.g. clinic1.leada-client.vercel.app)
app.use((req, res, next) => {
  const host = req.headers.host;
  if (!host) {
    req.subdomain = null;
    return next();
  }
  const hostname = host.split(':')[0]; // remove port if present
  const parts = hostname.split('.');
  req.subdomain = parts.length >= 4 ? parts[0] : null;
  next();
});

// Setup Socket.IO with matching CORS config
const io = new SocketIO(server, {
  cors: {
    origin: function(origin, callback) {
      if (!origin || allowedOrigins.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS error: Origin not allowed'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Make io accessible from routes/middleware if needed
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected');
  });
});

// Routes

// Your API routes from first snippet
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/queue', queueRoutes);

// Additional clinic routes from second snippet
app.use('/api/clinics', clinicRoutes);

// GET Clinic details from subdomain (first snippet)
app.get('/api/clinic', async (req, res) => {
  const subdomain = req.subdomain;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain not provided' });
  }
  try {
    const clinic = await Clinic.findOne({ domain: subdomain });
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    res.json({
      name: clinic.name,
      domain: clinic.domain,
      plan: clinic.plan,
      last_active_date: clinic.last_active_date,
    });
  } catch (err) {
    console.error('Error fetching clinic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/clinic/:subdomain', async (req, res) => {
  const subdomain = req.params.subdomain;
  try {
    const clinic = await Clinic.findOne({ slug: subdomain });
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    res.json(clinic);
  } catch (err) {
    console.error('Error fetching clinic by slug:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check route
app.get('/', (req, res) => {
  if (req.subdomain) {
    res.json({ message: `API running for clinic "${req.subdomain}"` });
  } else {
    res.json({ message: 'API running on main domain' });
  }
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB and start the server
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
