const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectName: { type: String, required: true },
  videoPath: { type: String, required: true },
  srtPath: { type: String, required: false, default: '' },
  exportedPath: { type: String, required: false, default: '' },
  studioSettings: { type: Object, required: false, default: {} },
  status: { type: String, enum: ['processing','completed','failed'], default: 'processing' },
  progress: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);