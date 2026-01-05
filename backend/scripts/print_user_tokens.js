const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node print_user_tokens.js <email>');
    process.exit(2);
  }

  // Mongoose no longer requires connection options in recent versions
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('User:', user.email);
  console.log('googleId:', user.googleId || '(none)');
  console.log('has googleAccessToken:', !!user.googleAccessToken);
  console.log('has googleRefreshToken:', !!user.googleRefreshToken);
  if (user.googleRefreshToken) {
    console.log('googleRefreshToken (truncated):', user.googleRefreshToken.slice(0, 8) + '...');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
