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
  const targetLang = req.body.targetLang || '';
  const sourceLang = req.body.sourceLang || 'auto';
  // Create project entry immediately with processing status
  const baseName = path.basename(movieFile.filename, path.extname(movieFile.filename));
  const placeholderSrt = '';
  let project;
  try {
    project = new Project({
      userId: decoded.id,
      projectName: req.body.projectName || 'Unnamed Project',
      videoPath: movieFile.path,
      srtPath: placeholderSrt,
      status: 'processing',
      progress: 0
    });
    await project.save();
    // Notify via websocket that a project was created/queued
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${decoded.id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 0 });
      }
    } catch (e) {
      console.warn('Emit project created failed', e);
    }
  } catch (dbErr) {
    console.error('DB create failed', dbErr);
    return res.status(500).json({ message: 'Database error' });
  }

  // Respond immediately with project id so client can poll status
  res.json({ message: 'Upload received', projectId: project._id });

  // Process in background: extract SRT, optionally translate, then update project
  (async () => {
    try {
      // Update progress to 10% (queued)
      await Project.findByIdAndUpdate(project._id, { progress: 10 });
      try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 10 }); } catch(e){ }

      // Mark extraction started
      await Project.findByIdAndUpdate(project._id, { progress: 30 });
      try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 30 }); } catch(e){ }

      // Run extractor with timeout and increased buffer to avoid hanging
      const srtContent = await new Promise((resolve, reject) => {
        exec(`python ../python/extract_srt.py "${movieFile.path}" "${sourceLang}"`, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
          if (err) {
            console.error('Python extractor error:', err, stderr.toString());
            reject(err);
          } else {
            resolve(stdout);
          }
        });
      });

      // Extraction finished
      await Project.findByIdAndUpdate(project._id, { progress: 60 });
      try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 60 }); } catch(e){ }

      let finalSrtPath = baseName + '.srt';
      try {
        const srtPath = path.join('uploads', baseName + '.srt');
        fs.writeFileSync(srtPath, srtContent, { encoding: 'utf8' });
        // verify file written and non-empty
        let srtStatOk = false;
        try {
          const st = fs.statSync(srtPath);
          srtStatOk = st && st.size > 0;
        } catch (stErr) {
          console.warn('SRT stat failed', stErr);
          srtStatOk = false;
        }
        if (!srtStatOk) {
          console.error('SRT file is empty or missing:', srtPath);
          await Project.findByIdAndUpdate(project._id, { status: 'failed', progress: 100 });
          return;
        }

        // If targetLang requested and different, translate segment texts
        if (targetLang) {
          try {
            const blocks = srtContent.split(/\r?\n\r?\n/).filter(Boolean);
            const translatedBlocks = [];
            for (const block of blocks) {
              const lines = block.split(/\r?\n/);
              if (lines.length < 3) { translatedBlocks.push(block); continue; }
              const idx = lines[0];
              const time = lines[1];
              const text = lines.slice(2).join('\n');

              const translateResp = await fetch('https://libretranslate.de/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: text, source: sourceLang || 'auto', target: targetLang, format: 'text' })
              });
              if (translateResp.ok) {
                const json = await translateResp.json();
                const translated = json.translatedText || text;
                translatedBlocks.push(`${idx}\n${time}\n${translated}`);
              } else {
                translatedBlocks.push(`${idx}\n${time}\n${text}`);
              }
            }
            const translatedSrt = translatedBlocks.join('\n\n') + '\n\n';
            const translatedPath = path.join('uploads', baseName + `_${targetLang}.srt`);
            fs.writeFileSync(translatedPath, translatedSrt, { encoding: 'utf8' });
            // verify translated file
            try {
              const st2 = fs.statSync(translatedPath);
              if (st2 && st2.size > 0) {
                finalSrtPath = baseName + `_${targetLang}.srt`;
              } else {
                console.warn('Translated SRT empty, keeping original');
              }
            } catch (s2Err) {
              console.warn('Translated SRT stat failed, keeping original', s2Err);
            }
          } catch (tErr) {
            console.warn('Translation failed, using original SRT', tErr);
          }
        }

        // Update project with final srt and mark complete
        await Project.findByIdAndUpdate(project._id, { srtPath: finalSrtPath, status: 'completed', progress: 100 });
        try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'completed', progress: 100, srtPath: finalSrtPath }); if (io) io.to(`user_${decoded.id}`).emit('project:update', { projectId: project._id.toString(), status: 'completed', progress: 100, srtPath: finalSrtPath }); } catch(e){ }
      } catch (fileErr) {
        console.error('SRT write failed:', fileErr);
        await Project.findByIdAndUpdate(project._id, { status: 'failed', progress: 100 });
        try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'failed', progress: 100 }); } catch(e){ }
      }
    } catch (err) {
      console.error('Processing failed for project', project._id, err);
      try { await Project.findByIdAndUpdate(project._id, { status: 'failed', progress: 100 }); } catch(e){}
      try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'failed', progress: 100 }); } catch(e){ }
    }
  })();
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

// Delete a project (and its files)
router.delete('/projects/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('DELETE /projects/:id called', { id: req.params.id, userId: decoded.id });
    let project = await Project.findOne({ _id: req.params.id, userId: decoded.id });
    if (!project) {
      // check if project exists but belongs to another user
      const found = await Project.findById(req.params.id);
      if (found) {
        console.warn('Project exists but user mismatch', { projectUser: found.userId.toString(), requester: decoded.id });
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(404).json({ message: 'Project not found' });
    }

    // Remove files if they exist
    try {
      if (project.videoPath && fs.existsSync(project.videoPath)) fs.unlinkSync(project.videoPath);
    } catch (e) {
      console.warn('Failed to remove video file', e);
    }
    try {
      const srtFull = path.join('uploads', project.srtPath);
      if (project.srtPath && fs.existsSync(srtFull)) fs.unlinkSync(srtFull);
    } catch (e) {
      console.warn('Failed to remove srt file', e);
    }

    await project.deleteOne();
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Status endpoint for client polling
router.get('/upload/status/:id', async (req, res) => {
  try {
    const proj = await Project.findById(req.params.id);
    if (!proj) return res.status(404).json({ message: 'Not found' });
    res.json({ status: proj.status, progress: proj.progress, srtPath: proj.srtPath });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update project: replace SRT text and/or update studio settings
router.put('/projects/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const project = await Project.findOne({ _id: req.params.id, userId: decoded.id });
    if (!project) {
      // If project exists but belongs to another user, return 403 to indicate forbidden
      const found = await Project.findById(req.params.id);
      if (found) {
        console.warn('Project update forbidden - user mismatch', { projectUser: found.userId.toString(), requester: decoded.id });
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(404).json({ message: 'Project not found' });
    }

    const { srtText, studioSettings } = req.body;
    // If srtText provided, write/overwrite srt file
    if (typeof srtText === 'string' && srtText.trim().length > 0) {
      try {
        // ensure project.srtPath exists or derive from videoPath
        let srtFileName = project.srtPath;
        if (!srtFileName || srtFileName.trim() === '') {
          const baseName = path.basename(project.videoPath || '', path.extname(project.videoPath || '')) || Date.now().toString();
          srtFileName = baseName + '.srt';
        }
        const srtFull = path.join('uploads', srtFileName);
        fs.writeFileSync(srtFull, srtText, { encoding: 'utf8' });
        // update project srtPath if it was empty
        if (!project.srtPath || project.srtPath !== srtFileName) project.srtPath = srtFileName;
      } catch (wErr) {
        console.error('Failed to write SRT during project update', wErr);
        return res.status(500).json({ message: 'Failed to write srt file' });
      }
    }

    // Update studio settings if provided
    if (studioSettings && typeof studioSettings === 'object') {
      project.studioSettings = studioSettings;
    }

    await project.save();
    // notify via socket
    try {
      const io = req.app.get('io');
      if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: project.status, progress: project.progress, srtPath: project.srtPath });
    } catch (e) { }

    res.json({ message: 'Project updated', projectId: project._id, srtPath: project.srtPath });
  } catch (err) {
    console.error('Project update failed', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;