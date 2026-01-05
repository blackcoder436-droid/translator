const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Project = require('../models/Project');
  const proj = new Project({
    userId: new mongoose.Types.ObjectId(),
    projectName: 'test-export-project',
    videoPath: path.resolve('uploads', '1767599683613.mp4'),
    srtPath: '1767599683613_my.srt',
    exportedPath: '',
    studioSettings: {
      fontSize: 36,
      fontColor: '#FF00FF',
      fontName: 'Arial',
      fontWeight: 'bold',
      fontItalic: true,
      xAxis: 50,
      yAxis: -30,
      showBackground: false,
      outlineWidth: 1,
      shadow: 0
    },
    status: 'completed',
    progress: 100
  });
  const saved = await proj.save();
  console.log('Created test project id:', saved._id.toString());
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
