const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:5001/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // DEBUG: log whether tokens were received (avoid printing raw tokens)
    console.log('passport-google callback:', {
      profileId: profile.id,
      gotAccessToken: !!accessToken,
      gotRefreshToken: !!refreshToken,
    });

    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      if (accessToken) user.googleAccessToken = accessToken;
      if (refreshToken) user.googleRefreshToken = refreshToken;
      await user.save();
      return done(null, user);
    }

    user = await User.findOne({ email: profile.emails[0].value });
    if (user) {
      user.googleId = profile.id;
      if (accessToken) user.googleAccessToken = accessToken;
      if (refreshToken) user.googleRefreshToken = refreshToken;
      await user.save();
      return done(null, user);
    }

    user = new User({
      name: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id
    });
    if (accessToken) user.googleAccessToken = accessToken;
    if (refreshToken) user.googleRefreshToken = refreshToken;
    await user.save();
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;