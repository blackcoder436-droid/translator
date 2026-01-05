const mongoose = require('mongoose');

const DriveFileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  driveFileId: {
    type: String,
    required: true,
    index: true
  },
  name: String,
  mimeType: String,
  size: Number,
  modifiedTime: Date,
  webViewLink: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  syncedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
DriveFileSchema.index({ userId: 1, driveFileId: 1 }, { unique: true });

module.exports = mongoose.model('DriveFile', DriveFileSchema);
