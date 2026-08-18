import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { createUploadUrl } from '../services/s3.js';
import { extractResumeText, parseResumeText } from '../services/resumeParser.js';

export const uploadsRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const schema = z.object({ filename: z.string().min(1), contentType: z.string().min(1) });

uploadsRouter.post('/presign', async (req, res, next) => {
  try {
    const input = schema.parse(req.body);
    res.json(await createUploadUrl(input.filename, input.contentType));
  } catch (error) {
    next(error);
  }
});

const localSchema = z.object({ filename: z.string().min(1), base64Data: z.string().min(1) });

uploadsRouter.post('/local', async (req, res, next) => {
  try {
    const { filename, base64Data } = localSchema.parse(req.body);
    const buffer = Buffer.from(base64Data, 'base64');
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    
    await fs.promises.writeFile(filePath, buffer);
    
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const publicUrl = `${protocol}://${req.get('host')}/uploads/${safeName}`;
    
    res.json({ publicUrl, key: safeName });
  } catch (error) {
    next(error);
  }
});


const resumeSchema = z.object({
  filename: z.string().min(1),
  base64Data: z.string().min(1),
});

uploadsRouter.post('/resume/parse', async (req, res, next) => {
  try {
    const { filename, base64Data } = resumeSchema.parse(req.body);
    const extension = path.extname(filename).toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(extension)) {
      return res.status(415).json({ message: 'Resume upload supports PDF, DOC and DOCX files only.' });
    }
    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer.length) return res.status(422).json({ message: 'The uploaded resume is empty.' });
    if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ message: 'Resume file must be 12 MB or smaller.' });

    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    await fs.promises.writeFile(filePath, buffer);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const publicUrl = `${protocol}://${req.get('host')}/uploads/${safeName}`;
    try {
      const extractedText = await extractResumeText(filename, buffer, filePath);
      if (!extractedText.trim()) throw new Error('No readable text was found in this resume.');
      const parsed = parseResumeText(extractedText);
      return res.json({ publicUrl, key: safeName, originalFilename: filename, extractedText, parsed, parseSucceeded: true });
    } catch (parseError) {
      return res.json({
        publicUrl, key: safeName, originalFilename: filename, extractedText: '', parsed: null, parseSucceeded: false,
        warning: parseError instanceof Error ? parseError.message : 'Resume parsing failed. Enter or correct the Consultant details manually.',
      });
    }
  } catch (error) {
    next(error);
  }
});
