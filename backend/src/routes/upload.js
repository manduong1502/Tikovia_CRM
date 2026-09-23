import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { supabase } from '../supabase.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

function getDriveClient() {
  const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function uploadToDrive(file) {
  const drive = getDriveClient();
  const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '1Dh_PPIQK19vCc1MKHLQ30XXKNjXvqHaA';

  if (!drive) {
    throw new Error('Google Drive credentials not configured');
  }

  const fileMetadata = {
    name: `${Date.now()}_${file.originalname}`,
    parents: [FOLDER_ID],
  };

  const media = {
    mimeType: file.mimetype,
    body: Readable.from(file.buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = response.data.id;

  // Make public reader
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (permErr) {
    console.warn('Set permission warning:', permErr.message);
  }

  // Direct viewable URL for images and files
  const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    url: directUrl,
    viewUrl: response.data.webViewLink,
    downloadUrl: response.data.webContentLink,
    fileId: fileId,
    name: file.originalname,
    size: file.size,
    type: file.mimetype
  };
}

// Upload to Supabase Storage (Public CDN)
async function uploadToSupabase(file) {
  const ext = path.extname(file.originalname);
  const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBase}_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;

  const { data, error } = await supabase.storage
    .from('materials')
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: pubData } = supabase.storage.from('materials').getPublicUrl(filename);

  return {
    url: pubData.publicUrl,
    filename: filename,
    name: file.originalname,
    size: file.size,
    type: file.mimetype
  };
}

// Fallback to local server disk
function saveToLocal(file) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname);
  const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanBase}_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, file.buffer);

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
  const fileUrl = `${baseUrl.replace(/\/+$/, '')}/uploads/${filename}`;

  return {
    url: fileUrl,
    filename: filename,
    name: file.originalname,
    size: file.size,
    type: file.mimetype
  };
}

// Single file upload
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // 1. Try Supabase Storage first (High-speed CDN, 100% compatible with Facebook Graph API)
      const supabaseResult = await uploadToSupabase(req.file);
      console.log('✅ Uploaded to Supabase Storage (CDN):', supabaseResult.name);
      return res.json({ success: true, ...supabaseResult });
    } catch (supabaseErr) {
      console.warn('Supabase upload failed, falling back to local disk:', supabaseErr.message);
      try {
        // 2. Fallback to local server disk
        const localResult = saveToLocal(req.file);
        return res.json({ success: true, ...localResult });
      } catch (localErr) {
        // 3. Fallback to Google Drive
        try {
          const driveResult = await uploadToDrive(req.file);
          console.log('✅ Uploaded to Google Drive:', driveResult.name);
          return res.json({ success: true, ...driveResult });
        } catch (driveErr) {
          throw new Error(`All upload targets failed: ${supabaseErr.message} | ${localErr.message} | ${driveErr.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Multiple files upload
router.post('/multiple', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploaded = [];
    for (const file of req.files) {
      try {
        // 1. Supabase Storage first
        const supabaseRes = await uploadToSupabase(file);
        uploaded.push(supabaseRes);
      } catch (sErr) {
        console.warn('Supabase upload error, trying local:', sErr.message);
        try {
          const localRes = saveToLocal(file);
          uploaded.push(localRes);
        } catch (lErr) {
          try {
            const driveRes = await uploadToDrive(file);
            uploaded.push(driveRes);
          } catch (dErr) {
            console.error('All targets failed for file:', file.originalname);
          }
        }
      }
    }

    res.json({ success: true, files: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
