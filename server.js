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

// ✅ ALLOWED ORIGINS (wildcard for subdomains like clinic1.token.leada360.com)
const allowedOrigins = [
  /^https:\/\/(?:[\w-]+\.)*token\.leada360\.com$/, // e.g., clinic1.token.leada360.com
  'https://token.leada360.com',                   // main frontend
  'https://token-api-0z44.onrender.com',          // backend on Render
  'http://localhost:3000',                        // local frontend dev
  /^http:\/\/(?:[\w-]+\.)*lvh\.me:3000$/           // *.lvh.me for dev
];

// ✅ Enhanced CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    console.log('🔍 CORS Origin:', origin);

    if (!origin) return callback(null, true); // allow curl or dev tools without origin

    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') return pattern === origin;
      return pattern.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error(`CORS error: ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// ✅ JSON middleware
app.use(express.json());

// ✅ Subdomain extraction
app.use((req, res, next) => {
  const host = req.headers.host;
  if (!host) {
    req.subdomain = null;
    return next();
  }

  const hostname = host.split(':')[0].toLowerCase().replace(/\.$/, '');
  const parts = hostname.split('.');

  if (parts.length >= 4 && parts[1] === 'token' && parts[2] === 'leada360') {
    req.subdomain = parts[0];
  } else if (parts.length >= 3 && parts[parts.length - 2] === 'lvh' && parts[parts.length - 1] === 'me') {
    req.subdomain = parts.slice(0, parts.length - 2).join('.');
  } else {
    req.subdomain = null;
  }

  next();
});

// ✅ Socket.IO with CORS
const io = new SocketIO(server, {
  cors: {
    origin: function(origin, callback) {
      console.log('🔌 Socket Origin:', origin);

      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some(pattern => {
        if (typeof pattern === 'string') return pattern === origin;
        return pattern.test(origin);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`❌ Socket CORS blocked: ${origin}`);
        callback(new Error('Socket.IO CORS error: Origin not allowed'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  }
});
app.set('io', io);

// ✅ Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected');
  });
});

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/clinics', clinicRoutes);

// ✅ Get clinic info by current subdomain
app.get('/api/clinic', async (req, res) => {
  const subdomain = req.subdomain;
  if (!subdomain) return res.status(400).json({ error: 'Subdomain not provided' });

  try {
    const clinic = await Clinic.findOne({ domain: subdomain });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

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

// ✅ Get clinic by subdomain param
app.get('/api/clinic/:subdomain', async (req, res) => {
  const subdomain = req.params.subdomain;
  try {
    const clinic = await Clinic.findOne({ slug: subdomain });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    res.json(clinic);
  } catch (err) {
    console.error('Error fetching clinic by slug:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Health check route
app.get('/', (req, res) => {
  if (req.subdomain) {
    res.json({ message: `API running for clinic "${req.subdomain}"` });
  } else {
    res.json({ message: 'API running on main domain' });
  }
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong!' });
});

// ✅ Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});
