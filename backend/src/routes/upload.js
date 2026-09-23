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

  const isVideo = file.mimetype.startsWith('video/');
  const baseUrl = process.env.BACKEND_URL || 'https://crm.tikovia.vn/api';
  const directUrl = isVideo 
    ? `${baseUrl.replace(/\/+$/, '')}/upload/drive-stream/${fileId}`
    : `https://lh3.googleusercontent.com/d/${fileId}`;

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

  const baseUrl = process.env.BACKEND_URL || 'https://crm.tikovia.vn/api';
  const fileUrl = `${baseUrl.replace(/\/+$/, '')}/uploads/${filename}`;

  return {
    url: fileUrl,
    filename: filename,
    name: file.originalname,
    size: file.size,
    type: file.mimetype
  };
}

// Direct binary streaming endpoint for files stored in Google Drive (Video & Files)
router.get('/drive-stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).json({ error: 'Google Drive client not configured' });
    }

    const meta = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });

    res.setHeader('Content-Type', meta.data.mimeType || 'application/octet-stream');
    if (meta.data.size) {
      res.setHeader('Content-Length', meta.data.size);
    }
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.data.name)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const fileStream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    fileStream.data.pipe(res);
  } catch (err) {
    console.error('Drive stream error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Single file upload (Public CDN for Facebook + Guaranteed Google Drive Fallback)
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 1. Luôn sao lưu vào Google Drive vĩnh viễn (tài khoản tikovia.dn@gmail.com)
    let driveResult = null;
    try {
      driveResult = await uploadToDrive(req.file);
      console.log('✅ Đã lưu trữ an toàn trên Google Drive:', driveResult.name);
    } catch (dErr) {
      console.warn('Google Drive notice:', dErr.message);
    }

    // 2. Tải lên Supabase Storage (Public CDN)
    let cdnResult;
    try {
      cdnResult = await uploadToSupabase(req.file);
      console.log('✅ Uploaded to Supabase Storage (CDN):', cdnResult.name);
    } catch (sErr) {
      console.warn('⚠️ Supabase Storage gặp sự cố (đầy bộ nhớ hoặc lỗi mạng):', sErr.message);
      // NẾU SUPABASE HẾT DUNG LƯỢNG: Tự động chuyển 100% sang link Google Drive Stream
      if (driveResult && driveResult.fileId) {
        const baseUrl = process.env.BACKEND_URL || 'https://crm.tikovia.vn/api';
        const streamUrl = `${baseUrl.replace(/\/+$/, '')}/upload/drive-stream/${driveResult.fileId}`;
        console.log('🔄 ĐÃ CHUYỂN SANG DÙNG GOOGLE DRIVE STREAM CHO FACEBOOK:', streamUrl);
        cdnResult = {
          ...driveResult,
          url: streamUrl
        };
      } else {
        // Fallback cuối cùng sang đĩa cứng local cPanel
        cdnResult = saveToLocal(req.file);
      }
    }

    return res.json({ success: true, ...cdnResult });
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
      let driveRes = null;
      try {
        driveRes = await uploadToDrive(file);
      } catch (dErr) {
        console.warn('Drive error on file:', dErr.message);
      }

      let fileRes;
      try {
        fileRes = await uploadToSupabase(file);
      } catch (sErr) {
        if (driveRes && driveRes.fileId) {
          const baseUrl = process.env.BACKEND_URL || 'https://crm.tikovia.vn/api';
          fileRes = {
            ...driveRes,
            url: `${baseUrl.replace(/\/+$/, '')}/upload/drive-stream/${driveRes.fileId}`
          };
        } else {
          fileRes = saveToLocal(file);
        }
      }
      uploaded.push(fileRes);
    }

    res.json({ success: true, files: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
