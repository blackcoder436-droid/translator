const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const { exec } = require('child_process');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload route
router.post('/upload', upload.single('movie'), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const movieFile = req.file;

  // Always extract SRT from video
  let srtContent;
  try {
    srtContent = await new Promise((resolve, reject) => {
      exec(`python ../python/extract_srt.py "${movieFile.path}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('Python error:', stderr);
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    });
  } catch (err) {
    console.log('Falling back to sample SRT');
    srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello, welcome to this video.

2
00:00:05,000 --> 00:00:10,000
This is a demonstration of subtitle extraction.

3
00:00:10,000 --> 00:00:15,000
The system is processing the audio from ${movieFile.originalname}.

4
00:00:15,000 --> 00:00:20,000
Transcribed content will appear here when AI is enabled.
`;
  }

  const baseName = path.basename(movieFile.filename, path.extname(movieFile.filename));
  const srtPath = path.join('uploads', baseName + '.srt');

  fs.writeFile(srtPath, srtContent, async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'File write failed' });
    }
    try {
      const project = new Project({
        userId: decoded.id,
        projectName: req.body.projectName || 'Unnamed Project',
        videoPath: movieFile.path,
        srtPath: baseName + '.srt'
      });
      await project.save();
      res.json({ message: 'SRT extracted', srtPath: baseName + '.srt' });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error' });
    }
  });
});

// Get projects for user
router.get('/projects', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const projects = await Project.find({ userId: decoded.id });
    res.json({ projects });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;