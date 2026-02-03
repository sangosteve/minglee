// backend/src/middleware/multer.middleware.ts
// Use require instead of import for problematic modules
const multer = require('multer');
import path from 'path';
import { Request } from 'express';

// Define File type locally since we can't import Express.Multer.File
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Configure storage
const storage = multer.diskStorage({
  destination: (
    req: Request, 
    file: MulterFile, 
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, 'uploads/');
  },
  filename: (
    req: Request, 
    file: MulterFile, 
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - simplified
const fileFilter = (req: Request, file: MulterFile, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mpeg|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: File type not supported!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilter
});

export default upload;