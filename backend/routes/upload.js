const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const { exec, spawnSync } = require('child_process');

const router = express.Router();
const mongoose = require('mongoose');

// Helper: remove project record and associated files
async function removeProjectAndFiles(req, projectId, reason) {
  try {
    const proj = await Project.findById(projectId);
    if (proj) {
      try {
        if (proj.videoPath && fs.existsSync(proj.videoPath)) fs.unlinkSync(proj.videoPath);
      } catch (e) { console.warn('Failed to remove video during cleanup', e); }
      try {
        const srtFull = path.join('uploads', proj.srtPath || '');
        if (proj.srtPath && fs.existsSync(srtFull)) fs.unlinkSync(srtFull);
        // also try removing any translated variants like base_my.srt
        const base = path.basename(proj.videoPath || '', path.extname(proj.videoPath || ''));
        const translatedCandidate = path.join('uploads', base + '_my.srt');
        if (fs.existsSync(translatedCandidate)) fs.unlinkSync(translatedCandidate);
      } catch (e) { console.warn('Failed to remove srt during cleanup', e); }
      try {
        await proj.deleteOne();
      } catch (e) { console.warn('Failed to delete project doc', e); }
    }
    try {
      const io = req.app.get('io');
      if (io) io.to(`project_${projectId}`).emit('project:update', { projectId: projectId.toString(), status: 'deleted', progress: 0, error: reason || 'Processing failed' });
    } catch (e) { }
  } catch (err) {
    console.error('removeProjectAndFiles failure', err);
  }
}

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

// Upload route - accepts both movie and optional srt file
router.post('/upload', upload.fields([{ name: 'movie', maxCount: 1 }, { name: 'srt', maxCount: 1 }]), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (!req.files || !req.files.movie) {
    return res.status(400).json({ message: 'No movie file uploaded' });
  }

  const movieFile = req.files.movie[0];
  const srtFile = req.files.srt ? req.files.srt[0] : null;
  // Default to Burmese ('my') to auto-translate extracted/uploaded SRTs
  const targetLang = req.body.targetLang || 'my';
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

      let srtContent = '';
      
      // If SRT file was provided by user, use it directly
      if (srtFile) {
        try {
          srtContent = fs.readFileSync(srtFile.path, 'utf8');
          console.log('Using uploaded SRT file:', srtFile.path);
          await Project.findByIdAndUpdate(project._id, { progress: 60 });
          try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 60 }); } catch(e){ }
        } catch (srtErr) {
          console.error('Failed to read uploaded SRT file:', srtErr);
          await removeProjectAndFiles(req, project._id, 'Failed to read uploaded SRT file');
          return;
        }
      } else {
        // Mark extraction started
        await Project.findByIdAndUpdate(project._id, { progress: 30 });
        try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 30 }); } catch(e){ }

        // Validate uploaded movie with ffmpeg to catch truncated/corrupt files early
        try {
          const probe = spawnSync('ffmpeg', ['-v', 'error', '-i', movieFile.path, '-f', 'null', '-'], { encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
          if (probe.status !== 0) {
            console.error('FFmpeg validation failed for', movieFile.path, 'stderr:', probe.stderr);
            try { fs.unlinkSync(movieFile.path); } catch (e) { console.warn('Failed to remove invalid upload', e); }
            await removeProjectAndFiles(req, project._id, 'Invalid or corrupted video file');
            return;
          }
        } catch (probeErr) {
          console.warn('FFmpeg probe threw an exception, continuing to extraction:', probeErr);
        }

        // Run extractor with timeout and increased buffer to avoid hanging
        // Use 'auto' for automatic language detection
        srtContent = await new Promise((resolve, reject) => {
          exec(`python ../python/extract_srt.py "${movieFile.path}" "auto"`, { timeout: 300000, maxBuffer: 1024 * 1024 * 10, shell: true, encoding: 'utf8' }, (err, stdout, stderr) => {
            if (err) {
              console.error('Python extractor error:', err.message);
              console.error('STDERR:', stderr.toString());
              reject(new Error(`Extraction failed: ${stderr.toString() || err.message}`));
            } else if (!stdout || stdout.trim().length === 0) {
              console.error('Python extractor returned empty output');
              reject(new Error('Extraction failed: No output from Python script'));
            } else {
              // Decode UTF-8 if needed
              const decoded = typeof stdout === 'string' ? stdout : Buffer.from(stdout).toString('utf8');
              resolve(decoded);
            }
          });
        });

        // Extraction finished
        await Project.findByIdAndUpdate(project._id, { progress: 60 });
        try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'processing', progress: 60 }); } catch(e){ }
      }

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
          await removeProjectAndFiles(req, project._id, 'Empty or missing srt file');
          return;
        }

        // If targetLang requested, use the local Python translator for more reliable Burmese translation
        if (targetLang) {
          try {
            const srtFull = path.join(process.cwd(), 'uploads', baseName + '.srt');
            // Prefer the python googletrans-based script (translate_googletrans.py) which outputs <base>_my.srt
            const pyScript = path.join(__dirname, '..', 'scripts', 'translate_googletrans.py');
            await new Promise((resolve, reject) => {
              exec(`python "${pyScript}" "${srtFull}"`, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
                if (err) {
                  console.warn('Python translator failed', err?.message || err, 'STDERR:', stderr?.toString());
                  return reject(err);
                }
                resolve(stdout?.toString());
              });
            });

            const translatedName = baseName + `_${targetLang}.srt`;
            const translatedPath = path.join('uploads', translatedName);
            try {
              const st2 = fs.statSync(translatedPath);
              if (st2 && st2.size > 0) {
                finalSrtPath = translatedName;
              } else {
                console.warn('Translated SRT empty, keeping original');
              }
            } catch (s2Err) {
              console.warn('Translated SRT stat failed, keeping original', s2Err);
            }
          } catch (tErr) {
            console.warn('Translation failed (python), using original SRT', tErr);
          }
        }

        // Update project with final srt and mark complete
        await Project.findByIdAndUpdate(project._id, { srtPath: finalSrtPath, status: 'completed', progress: 100 });
        try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:update', { projectId: project._id.toString(), status: 'completed', progress: 100, srtPath: finalSrtPath }); if (io) io.to(`user_${decoded.id}`).emit('project:update', { projectId: project._id.toString(), status: 'completed', progress: 100, srtPath: finalSrtPath }); } catch(e){ }
      } catch (fileErr) {
        console.error('SRT write failed:', fileErr);
        await removeProjectAndFiles(req, project._id, 'SRT write failed');
      }
    } catch (err) {
      console.error('Processing failed for project', project._id, err);
      try { await removeProjectAndFiles(req, project._id, 'Processing failed on server'); } catch(e){ }
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

// Export a project video with burned-in subtitles
// POST /projects/:id/export
router.post('/projects/:id/export', async (req, res) => {
  // Allow bypassing auth in development by sending header 'x-skip-auth: 1'
  const skipAuth = req.headers['x-skip-auth'] === '1';
  let decoded = null;
  if (!skipAuth) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('JWT verify failed', err && err.stack ? err.stack : err);
      return res.status(401).json({ message: 'Invalid token' });
    }
  }

  try {
    if (mongoose && mongoose.connection && mongoose.connection.readyState !== 1) {
      console.error('Database not connected when handling export');
      return res.status(500).json({ message: 'Server error: database not connected' });
    }
    const project = skipAuth ? await Project.findById(req.params.id) : await Project.findOne({ _id: req.params.id, userId: decoded.id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Only allow export when subtitles exist
    if (!project.srtPath || project.srtPath.trim() === '') {
      return res.status(400).json({ message: 'No subtitles available for this project' });
    }
    if (project.status !== 'completed') {
      return res.status(400).json({ message: 'Project not completed yet' });
    }

    const base = path.basename(project.videoPath || '', path.extname(project.videoPath || '')) || Date.now().toString();
    const exportsDir = path.join('uploads', 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const outName = base + '_subtitled.mp4';
    const outFull = path.join(exportsDir, outName);
    
    // Log: Confirm studio settings are present in project
    console.log('Export initiated:', {
      projectId: project._id.toString(),
      hasStudioSettings: !!project.studioSettings,
      studioSettings: project.studioSettings
    });

    // If already exported, check whether it's a hard-burn (no subtitle streams).
    // If it only contains a subtitle track (mov_text), re-export to force a hard-burn.
    if (fs.existsSync(outFull)) {
      try {
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-select_streams', 's', '-print_format', 'json', outFull], { encoding: 'utf8', timeout: 20000 });
        if (probe.status === 0 && probe.stdout) {
          const info = JSON.parse(probe.stdout);
          const streams = info.streams || [];
          // If there are subtitle streams, remove the file to force re-export (burn-in)
          if (streams.length > 0) {
            try { fs.unlinkSync(outFull); } catch (e) { console.warn('Failed to remove old export, will overwrite', e); }
          } else {
            const url = `/uploads/exports/${outName}`;
            return res.json({ message: 'Export ready', url });
          }
        } else {
          // probe failed, remove and re-export
          try { fs.unlinkSync(outFull); } catch (e) { }
        }
      } catch (e) {
        try { fs.unlinkSync(outFull); } catch (er) { }
      }
    }

    // Build absolute paths and normalize for ffmpeg
    const absVideo = path.resolve(project.videoPath);
    const absSrt = path.resolve('uploads', project.srtPath);

    // Run ffmpeg to burn subtitles into the video
    try {
      // Create an ASS file from the SRT and studio settings so we can burn subtitles into the video
      const srtText = fs.readFileSync(absSrt, 'utf8');
      const studio = project.studioSettings || {};
      const fontSize = studio.fontSize || 24;
      const fontColor = studio.fontColor || '#FFFFFF';
      const fontName = studio.fontName || 'Arial';
      const italic = studio.fontItalic ? 1 : 0;
      const bold = (studio.fontWeight === 'bold' || (studio.fontWeight && studio.fontWeight.toString().toLowerCase().includes('bold'))) ? 1 : 0;
      const xAxis = studio.xAxis || 0;
      const yAxis = studio.yAxis || 0;
      const showBackground = studio.showBackground !== false; // default to true
      const marginV = 10 + (yAxis ? Math.abs(Math.round(yAxis)) : 0);
      const marginL = Math.max(0, 10 + Math.round(xAxis)); // Left margin adjusted by X-axis
      const marginR = Math.max(0, 10 - Math.round(xAxis)); // Right margin adjusted by X-axis

      function hexToAssColor(hex) {
        const h = (hex || '#ffffff').replace('#','');
        const r = h.substring(0,2);
        const g = h.substring(2,4);
        const b = h.substring(4,6);
        return `&H00${b}${g}${r}`; // ASS uses &HAABBGGRR, AA=00
      }

      function parseSrtToAssEvents(srt) {
        const parts = srt.split(/\n\s*\n/);
        const events = [];
        for (const part of parts) {
          const lines = part.split(/\r?\n/).filter(Boolean);
          if (lines.length >= 2) {
            // first line may be index
            let ti = 0;
            if (/^\d+$/.test(lines[0].trim())) {
              ti = 1;
            }
            const times = lines[ti].split('-->');
            if (!times || times.length < 2) continue;
            const start = srtTimeToAss(times[0].trim());
            const end = srtTimeToAss(times[1].trim());
            const text = lines.slice(ti+1).join('\\N').replace(/"/g, "'");
            events.push({ start, end, text });
          }
        }
        return events;
      }

      function srtTimeToAss(s) {
        // SRT: 00:00:01,500 -> ASS: 0:00:01.50 (H:MM:SS.cc)
        const m = /(?:(\d+):)?(\d{2}):(\d{2}),(\d{1,3})/.exec(s) || /^(\d{2}):(\d{2}):(\d{2}),(\d{1,3})$/.exec(s);
        if (!m) return '0:00:00.00';
        let hh, mm, ss, ms;
        if (m.length === 5) {
          hh = m[1] || 0; mm = m[2]; ss = m[3]; ms = m[4];
        } else {
          hh = m[1]; mm = m[2]; ss = m[3]; ms = m[4];
        }
        const cs = Math.round((parseInt(ms,10) || 0) / 10);
        return `${hh}:${mm}:${ss}.${cs.toString().padStart(2,'0')}`;
      }

      const events = parseSrtToAssEvents(srtText);

      // Prefer drawtext with a local TTF font if available (better for Myanmar script rendering)
      const fontsDir = path.join(__dirname, '..', 'fonts');
      let usedDrawText = false;
      if (fs.existsSync(fontsDir)) {
        const cand = fs.readdirSync(fontsDir).filter(f => f.toLowerCase().endsWith('.ttf') || f.toLowerCase().endsWith('.otf'));
        if (cand.length > 0) {
          const fontFile = path.resolve(path.join(fontsDir, cand[0]));
          // Build drawtext filters for each event
          function srtTimeToSeconds(s) {
            const m = /(?:(\d+):)?(\d{2}):(\d{2}),?(\d{1,3})/.exec(s);
            if (!m) return 0;
            const hh = parseInt(m[1] || '0', 10);
            const mm = parseInt(m[2], 10);
            const ss = parseInt(m[3], 10);
            const ms = parseInt(m[4] || '0', 10);
            return hh*3600 + mm*60 + ss + (ms/1000);
          }

          const drawParts = [];
          const fontPathForFfmpeg = fontFile.replace(/\\/g, '/');
          const boxcolor = showBackground ? 'black@0.6' : 'black@0';
          const fontsize = fontSize;
          // Position: center horizontally with X-axis offset, positioned from bottom with Y-axis offset
          const xPos = xAxis >= 0 ? `(w-text_w)/2+${xAxis}` : `(w-text_w)/2${xAxis}`;
          const yPos = `h-${marginV}`;
          // Re-parse SRT to numeric events
          const parts = srtText.split(/\n\s*\n/);
          const eventsNum = [];
          for (const part of parts) {
            const lines = part.split(/\r?\n/).filter(Boolean);
            if (lines.length >= 2) {
              let ti = 0;
              if (/^\d+$/.test(lines[0].trim())) ti = 1;
              const times = lines[ti].split('-->');
              if (!times || times.length < 2) continue;
              const start = srtTimeToSeconds(times[0].trim());
              const end = srtTimeToSeconds(times[1].trim());
              const text = lines.slice(ti+1).join('\\n').replace(/'/g, "\\'");
              eventsNum.push({ start, end, text });
            }
          }

          for (const en of eventsNum) {
            const txt = en.text.replace(/:/g, '\\:').replace(/,/g, '\\,');
            const fontweightStr = bold ? ':fontweight=bold' : '';
            const fontangleStr = italic ? ':fontangle=15' : '';
            const part = `drawtext=fontfile='${fontPathForFfmpeg}':text='${txt}':fontsize=${fontsize}:fontcolor=${fontColor}:x=${xPos}:y=${yPos}:box=${showBackground ? 1 : 0}:boxcolor=${boxcolor}:boxborderw=${showBackground ? 6 : 0}${fontweightStr}${fontangleStr}:enable='between(t,${en.start},${en.end})'`;
            drawParts.push(part);
          }

          if (drawParts.length > 0) {
            const vf = drawParts.join(',');
            const ff = spawnSync('ffmpeg', ['-y', '-i', absVideo, '-vf', vf, '-c:a', 'copy', outFull], { timeout: 1200000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 });
            if (ff.status !== 0) {
              console.error('ffmpeg drawtext export failed', ff.stderr);
              // fallthrough to ASS method
            } else {
              usedDrawText = true;
            }
          }
        }
      }

      if (!usedDrawText) {
        // Fallback to ASS method
        const assLines = [];
        assLines.push('[Script Info]');
        assLines.push('ScriptType: v4.00+');
        // Determine video resolution and set PlayRes to match Studio Tools coordinates
        let playResX = 1280, playResY = 720;
        try {
          const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', absVideo], { encoding: 'utf8', timeout: 20000 });
          if (probe.status === 0 && probe.stdout) {
            const parts = probe.stdout.trim().split('x');
            if (parts.length === 2) {
              playResX = parseInt(parts[0], 10) || playResX;
              playResY = parseInt(parts[1], 10) || playResY;
            }
          }
        } catch (e) { }
        assLines.push(`PlayResX: ${playResX}`);
        assLines.push(`PlayResY: ${playResY}`);
        assLines.push('');
        assLines.push('[V4+ Styles]');
        assLines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
        // Prefer a font from backend/fonts if present and map studio font name
        let assFontName = fontName;
        try {
          const fontsDir = path.join(__dirname, '..', 'fonts');
          if (fs.existsSync(fontsDir)) {
            const cand = fs.readdirSync(fontsDir).find(f => f.toLowerCase().endsWith('.ttf') || f.toLowerCase().endsWith('.otf'));
            if (cand) {
              // Use the file name (without extension) as the ASS Fontname -- libass/fontconfig will resolve
              assFontName = path.basename(cand, path.extname(cand)).replace(/[-_]/g, ' ');
            }
          }
        } catch (e) { }
        // Map studio settings to ASS Style (Outline = Outline, Shadow = 0..)
        const outline = studio.outlineWidth || 1;
        const shadow = studio.shadow || 0;
        // Create color with optional background based on showBackground setting
        const backColor = showBackground ? '&H000000AA' : '&H00000000'; // Semi-transparent black if background shown
        assLines.push(`Style: Default,${assFontName},${fontSize},${hexToAssColor(fontColor)},&H000000FF,&H00000000,${backColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},2,${marginL},${marginR},${marginV},1`);
        assLines.push('');
        assLines.push('[Events]');
        assLines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');
        for (const ev of events) {
          assLines.push(`Dialogue: 0,${ev.start},${ev.end},Default,,0,0,0,,${ev.text}`);
        }
        
        // Log studio settings being used for debugging
        console.log('Export: Applied studio settings', {
          fontSize, fontColor, fontName: assFontName, bold, italic,
          xAxis, yAxis, marginL, marginR, marginV,
          showBackground, backColor, outline, shadow
        });

        const assRel = path.join('uploads', 'exports', base + '.ass');
        const absAss = path.resolve(assRel);
        fs.writeFileSync(absAss, assLines.join('\n'), { encoding: 'utf8' });

        // Use ass filter to burn subtitles into the video. Ensure path uses forward slashes for ffmpeg.
        // Call helper script that writes the ASS and invokes ffmpeg robustly
        const assScript = path.join(__dirname, '..', 'scripts', 'ass_burn_from_srt.js');
        try {
          const nodeRun = spawnSync('node', [assScript, absSrt, absVideo, outFull], { timeout: 1200000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 });
          if (nodeRun.status !== 0) {
            console.error('ASS burn script failed', nodeRun.stderr || nodeRun.stdout);
            return res.status(500).json({ message: 'Export failed', error: nodeRun.stderr || nodeRun.stdout });
          }
        } catch (e) {
          console.error('ASS burn script thrown', e && e.stack ? e.stack : e);
          return res.status(500).json({ message: 'Export failed', error: e && e.message ? e.message : e });
        }
      }
    } catch (ffErr) {
      console.error('ffmpeg thrown error', ffErr);
      return res.status(500).json({ message: 'Export failed', error: ffErr.message });
    }

    // Update project with exported path and return URL
    const exportedRel = path.join('uploads', 'exports', outName);
    try {
      await Project.findByIdAndUpdate(project._id, { exportedPath: exportedRel });
    } catch (uErr) {
      console.warn('Failed to update project exportedPath', uErr);
    }

    const url = `/uploads/exports/${outName}`;
    try { const io = req.app.get('io'); if (io) io.to(`project_${project._id}`).emit('project:export', { projectId: project._id.toString(), url }); } catch(e){}
    res.json({ message: 'Export ready', url });
  } catch (err) {
    console.error('Export failed', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Stream exported video as an attachment for download
// GET /projects/:id/download
router.get('/projects/:id/download', async (req, res) => {
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
    if (!project) return res.status(404).json({ message: 'Project not found' });
    // Allow fallback: if exportedPath not set, derive expected export from videoPath
    let exportedRel = project.exportedPath && project.exportedPath.trim() !== '' ? project.exportedPath : '';
    if (!exportedRel || exportedRel.trim() === '') {
      const base = path.basename(project.videoPath || '', path.extname(project.videoPath || '')) || '';
      exportedRel = path.join('uploads', 'exports', base + '_subtitled.mp4');
    }

    const abs = path.resolve(exportedRel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'Exported file not found' });

    // Use res.download to force attachment and proper filename
    return res.download(abs, path.basename(abs), (err) => {
      if (err) console.error('Download failed', err);
    });
  } catch (err) {
    console.error('Download endpoint error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});