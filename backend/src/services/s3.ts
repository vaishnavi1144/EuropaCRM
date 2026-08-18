import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { readSystemSettings } from '../routes/settings.js';

export async function createUploadUrl(filename: string, contentType: string) {
  const settings = await readSystemSettings().catch(() => null);
  const accessKeyId = env.AWS_ACCESS_KEY_ID || String(settings?.s3AccessKey ?? '');
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || String(settings?.s3SecretKey ?? '');
  const bucket = env.AWS_S3_BUCKET || String(settings?.s3Bucket ?? '');
  const region = process.env.AWS_REGION ? env.AWS_REGION : String(settings?.s3Region ?? 'ap-south-1');

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS S3 is not configured. Save the bucket, region and IAM credentials in Settings or backend/.env.');
  }

  const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  const key = `crm-uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
  return { key, uploadUrl, publicUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}` };
}
