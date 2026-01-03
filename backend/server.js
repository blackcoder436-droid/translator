require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use('/uploads', express.static('uploads'));

app.use('/auth', authRoutes);
app.use('/api', uploadRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));