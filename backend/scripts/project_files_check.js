const mongoose = require('mongoose');
const Project = require('../models/Project');
const fs = require('fs');
require('dotenv').config();

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const pros = await Project.find({}).sort({createdAt:-1}).limit(20).lean();
  console.log('Recent projects file status:');
  pros.forEach(p=>{
    const vp = p.videoPath || '';
    const sp = p.srtPath || '';
    const videoExists = vp ? fs.existsSync(vp) || fs.existsSync(require('path').join('uploads', require('path').basename(vp))) : false;
    const srtExists = sp ? fs.existsSync(require('path').join('uploads', sp)) : false;
    console.log('---');
    console.log('id:', p._id.toString());
    console.log('name:', p.projectName);
    console.log('videoPath:', vp, 'videoExists:', videoExists);
    console.log('srtPath:', sp, 'srtExists:', srtExists);
    console.log('status:', p.status, 'progress:', p.progress);
  });
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
