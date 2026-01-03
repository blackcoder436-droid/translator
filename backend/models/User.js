const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  email_verified_at: Date,
  banned_at: Date,
  role: { type: String, default: 'user' },
  googleId: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);