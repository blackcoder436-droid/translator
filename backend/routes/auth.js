const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');

const router = express.Router();
const axios = require('axios');

// Register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        banned_at: user.banned_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        banned_at: user.banned_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Forget Password
router.post('/forget-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();
    // Send email
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset',
      text: `Reset your password: http://localhost:3000/reset-password?token=${resetToken}`
    };
    transporter.sendMail(mailOptions, (err) => {
      if (err) return res.status(500).json({ message: 'Error sending email' });
      res.json({ message: 'Reset email sent' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.resetToken !== token || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
});

// Google Auth - request Drive readonly + offline access at login so permission is granted once
console.log('Registering GET /auth/google route');
router.get('/google', (req, res, next) => {
  console.log('GET /auth/google called');
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.redirect(`http://localhost:3000?token=${token}`); // redirect to frontend
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      status: 'success',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        banned_at: user.banned_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        role: user.role
      }
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Return a fresh Drive access token using stored refresh token
router.get('/drive-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.googleRefreshToken) return res.status(400).json({ message: 'No Google refresh token available' });

    const params = new URLSearchParams();
    params.append('client_id', process.env.GOOGLE_CLIENT_ID);
    params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    params.append('refresh_token', user.googleRefreshToken);
    params.append('grant_type', 'refresh_token');

    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return res.json({ access_token: tokenResp.data.access_token, expires_in: tokenResp.data.expires_in });
  } catch (err) {
    console.error('drive-token error', err?.message || err);
    return res.status(400).json({ message: 'Failed to obtain drive token' });
  }
});

module.exports = router;