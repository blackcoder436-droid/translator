const mongoose = require('mongoose');
const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const failed = await Project.find({ status: 'failed' }).lean();
  if (!failed || failed.length === 0) {
    console.log('No failed projects found');
    process.exit(0);
  }
  console.log(`Found ${failed.length} failed project(s)`);
  for (const p of failed) {
    try {
      console.log('Removing project', p._id.toString(), 'videoPath:', p.videoPath, 'srtPath:', p.srtPath);
      // remove video
      if (p.videoPath) {
        const vPath = path.normalize(p.videoPath);
        // if path is relative, make absolute to repo root
        const absV = path.isAbsolute(vPath) ? vPath : path.join(process.cwd(), vPath);
        if (fs.existsSync(absV)) {
          fs.unlinkSync(absV);
          console.log('  removed video', absV);
        } else {
          console.log('  video not found:', absV);
        }
      }
      // remove srt
      if (p.srtPath) {
        const srtRel = path.join('uploads', p.srtPath);
        const absS = path.join(process.cwd(), srtRel);
        if (fs.existsSync(absS)) {
          fs.unlinkSync(absS);
          console.log('  removed srt', absS);
        } else {
          console.log('  srt not found:', absS);
        }
      }
      // try translated variant
      if (p.videoPath) {
        const base = path.basename(p.videoPath, path.extname(p.videoPath));
        const trans = path.join(process.cwd(), 'uploads', base + '_my.srt');
        if (fs.existsSync(trans)) {
          fs.unlinkSync(trans);
          console.log('  removed translated srt', trans);
        }
      }
      // delete db doc
      await Project.deleteOne({ _id: p._id });
      console.log('  deleted project doc', p._id.toString());
    } catch (e) {
      console.error('Failed to remove project', p._id.toString(), e);
    }
  }
  console.log('Cleanup complete');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
