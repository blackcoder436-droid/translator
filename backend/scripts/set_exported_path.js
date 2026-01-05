const mongoose = require('mongoose');
const Project = require('../models/Project');
require('dotenv').config();

async function main() {
  const [,, exportedRel, projectId] = process.argv;
  if (!exportedRel || !projectId) {
    console.error('Usage: node set_exported_path.js <exportedRel> <projectId>');
    process.exit(2);
  }
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in environment. Set it in backend/.env or export it in the shell.');
    process.exit(3);
  }
  try {
    // Newer mongoose versions don't accept connection options like
    // useNewUrlParser/useUnifiedTopology; pass the URI directly.
    await mongoose.connect(uri);
    const proj = await Project.findById(projectId);
    if (!proj) {
      console.error('Project not found', projectId);
      process.exit(4);
    }
    proj.exportedPath = exportedRel;
    await proj.save();
    console.log('Updated exportedPath for', projectId, '->', exportedRel);
    process.exit(0);
  } catch (err) {
    console.error('Error updating exportedPath', err && err.stack ? err.stack : err);
    process.exit(5);
  }
}

main();
