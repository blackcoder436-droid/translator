const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Upload a file to Google Drive
async function uploadToDrive(accessToken, filePath, fileName, mimeType = 'application/octet-stream', folderId = null) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Prepare metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      ...(folderId && { parents: [folderId] })
    };

    // Use multipart upload for Drive API v3
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', fileStream);

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/related'
        }
      }
    );

    return response.data; // { id, name, mimeType, webViewLink, ... }
  } catch (err) {
    console.error('Drive upload failed:', err.response?.data || err.message);
    throw err;
  }
}

// Get or create a folder in Google Drive
async function getOrCreateFolder(accessToken, folderName, parentFolderId = null) {
  try {
    // Search for existing folder
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchRes = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: query,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      }
    });

    if (searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id;
    }

    // Create folder if not found
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] })
    };

    const createRes = await axios.post('https://www.googleapis.com/drive/v3/files', metadata, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'id' }
    });

    return createRes.data.id;
  } catch (err) {
    console.error('Folder operation failed:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  uploadToDrive,
  getOrCreateFolder
};
