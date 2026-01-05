const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const pros = await Project.find({}).sort({createdAt:-1}).limit(20).lean();
  console.log('Recent projects:');
  pros.forEach(p=>{
    console.log('---');
    console.log('id:', p._id);
    console.log('userId:', p.userId);
    console.log('name:', p.projectName);
    console.log('videoPath:', p.videoPath);
    console.log('srtPath:', p.srtPath);
    console.log('status:', p.status, 'progress:', p.progress, 'createdAt:', p.createdAt);
  });
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
