require('dotenv').config();
// Diagnostic logs to help debug missing /auth routes
console.log('ENV: GOOGLE_CLIENT_ID present?', !!process.env.GOOGLE_CLIENT_ID);
console.log('ENV: GOOGLE_CLIENT_SECRET present?', !!process.env.GOOGLE_CLIENT_SECRET);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
let passport = null;
let authRoutes = null;
try {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport = require('./config/passport');
    authRoutes = require('./routes/auth');
  } else {
    console.warn('Google OAuth not configured; skipping passport and auth routes');
  }
} catch (e) {
  console.error('Passport initialization skipped due to config error:', e && e.stack ? e.stack : e && e.message ? e.message : e);
}

console.log('passport loaded?', !!passport, 'authRoutes loaded?', !!authRoutes);
const uploadRoutes = require('./routes/upload');
const translateRoutes = require('./routes/translate');

const app = express();

app.use(cors());
app.use(express.json());

// Session middleware (required for Passport.js OAuth)
app.use(session({
  secret: process.env.JWT_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

if (passport) {
  app.use(passport.initialize());
  app.use(passport.session());
}
app.use('/uploads', express.static('uploads'));

if (authRoutes) app.use('/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/translate', translateRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5001;

// Create HTTP server and attach Socket.io for realtime events
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// Make io available to routes via app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  // Join rooms on client request: { projectId } or { userId }
  socket.on('join', (data) => {
    try {
      if (data?.projectId) socket.join(`project_${data.projectId}`);
      if (data?.userId) socket.join(`user_${data.userId}`);
    } catch (e) {
      console.warn('Socket join failed', e);
    }
  });

  socket.on('disconnect', () => {
    // noop for now
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

// Periodic background sync: refresh Drive metadata into MongoDB every 10 minutes
const axios = require('axios');
const User = require('./models/User');
const DriveFile = require('./models/DriveFile');

async function syncAllDriveFiles() {
  try {
    const users = await User.find({ googleRefreshToken: { $exists: true, $ne: null } }).lean();
    for (const user of users) {
      try {
        const params = new URLSearchParams();
        params.append('client_id', process.env.GOOGLE_CLIENT_ID);
        params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
        params.append('refresh_token', user.googleRefreshToken);
        params.append('grant_type', 'refresh_token');

        const tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const accessToken = tokenResp.data.access_token;

        const driveRes = await axios.get('https://www.googleapis.com/drive/v3/files', {
          params: {
            q: "mimeType contains 'video/' and trashed=false",
            spaces: 'drive',
            fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
            pageSize: 1000
          },
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const files = driveRes.data.files || [];
        for (const file of files) {
          try {
            await DriveFile.findOneAndUpdate(
              { userId: user._id, driveFileId: file.id },
              {
                userId: user._id,
                driveFileId: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                modifiedTime: file.modifiedTime,
                webViewLink: file.webViewLink,
                syncedAt: new Date()
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.warn('Failed to upsert DriveFile for user', user._id, e && e.message ? e.message : e);
          }
        }
        console.log(`Drive sync: user ${user._id} - ${files.length} files`);
      } catch (uErr) {
        console.warn('Drive sync failed for user', user._id, uErr && uErr.message ? uErr.message : uErr);
      }
    }
  } catch (err) {
    console.error('syncAllDriveFiles error', err && err.message ? err.message : err);
  }
}

// Run once shortly after startup, then every 10 minutes
setTimeout(() => { syncAllDriveFiles().catch(e => console.error(e)); }, 30 * 1000);
setInterval(() => { syncAllDriveFiles().catch(e => console.error(e)); }, 10 * 60 * 1000);

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION', reason);
});