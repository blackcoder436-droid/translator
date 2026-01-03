require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const translateRoutes = require('./routes/translate');

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use('/uploads', express.static('uploads'));

app.use('/auth', authRoutes);
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

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));