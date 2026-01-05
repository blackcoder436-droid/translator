const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const pros = await Project.find({ videoPath: /Ep1/ }).lean();
  console.log('Matches for Ep1:');
  console.dir(pros, { depth: 4 });
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
