import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Storage configuration - works with S3, R2, DigitalOcean Spaces, etc.
const getStorageClient = () => {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  const endpoint = process.env.R2_ENDPOINT // e.g., https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
  const region = process.env.R2_REGION || process.env.AWS_REGION || 'auto'

  if (!accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
}

const getBucketName = () => {
  return process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'blue-pacific-photos'
}

export const isStorageConfigured = (): boolean => {
  const client = getStorageClient()
  return client !== null && !!getBucketName()
}

/**
 * Applies a 30-day expiration lifecycle rule to the R2 bucket.
 * Runs once at server startup when cloud storage is configured.
 * Safe to call repeatedly — it just overwrites the rule with the same config.
 */
export async function applyLifecycleRule(): Promise<void> {
  const client = getStorageClient()
  const bucketName = getBucketName()
  if (!client || !bucketName) return

  // Check if rule already exists before applying
  try {
    const existing = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName }))
    const alreadySet = existing.Rules?.some(r =>
      r.ID === 'auto-delete-uploads-30d' && r.Status === 'Enabled'
    )
    if (alreadySet) {
      console.log('[Storage] R2 lifecycle rule already applied — skipping')
      return
    }
  } catch {
    // No lifecycle config exists yet — proceed to create it
  }

  await client.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: bucketName,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: 'auto-delete-uploads-30d',
          Status: 'Enabled',
          Filter: { Prefix: 'uploads/' },
          Expiration: { Days: 30 }
        }
      ]
    }
  }))

  console.log('[Storage] ✅ R2 lifecycle rule applied: uploads/ auto-deletes after 30 days')
}

export const uploadPhoto = async (
  buffer: Buffer, 
  mimetype: string, 
  originalname: string
): Promise<string> => {
  const client = getStorageClient()
  const bucketName = getBucketName()

  if (!client) {
    throw new Error('Cloud storage not configured')
  }

  // Generate unique filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const extension = originalname.split('.').pop() || 'jpg'
  const key = `uploads/${timestamp}-${random}.${extension}`

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      originalName: originalname,
      uploadedAt: new Date().toISOString()
    }
  })

  await client.send(command)

  // If using R2 with public bucket or custom domain
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.AWS_CLOUDFRONT_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }

  // Otherwise, generate signed URL (valid for 7 days)
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  })
  
  const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 7 * 24 * 60 * 60 })
  return signedUrl
}

// Fallback: in-memory storage (for development without cloud config)
const memoryStore = new Map<string, { buffer: Buffer, mimetype: string, originalname: string }>()

export const uploadPhotoMemory = (
  buffer: Buffer, 
  mimetype: string, 
  originalname: string,
  baseUrl: string
): string => {
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  memoryStore.set(photoId, { buffer, mimetype, originalname })
  return `${baseUrl}/api/photos/${photoId}`
}

export const getPhotoFromMemory = (photoId: string) => {
  return memoryStore.get(photoId)
}

/* ────────────────────────────────────────────────────────────────────────────
 * DURABLE LEAD RECORDS
 *
 * Why this exists: this app has no database. Before 2026-08-25 the ONLY record
 * of a lead was the notification itself — Zapier, Slack, email. Every one of
 * those is guarded and silently no-ops when unconfigured, and they were all
 * wrapped in Promise.allSettled, so /api/submit-estimate returned 200 even when
 * a lead reached precisely nobody. The customer saw "Got it!", the Google Ads
 * conversion fired, and the lead evaporated with no trace anywhere.
 *
 * Now every submission is written to object storage FIRST, before any
 * notification is attempted. Notifications become a delivery convenience rather
 * than the system of record. If every channel is down, the lead is still on
 * disk and recoverable.
 *
 * NOTE ON RETENTION: written under the `leads/` prefix deliberately. The
 * lifecycle rule above auto-deletes `uploads/` after 30 days; `leads/` is not
 * covered by it and is kept indefinitely. Do not widen that rule's prefix.
 * ──────────────────────────────────────────────────────────────────────────── */

export const persistLeadRecord = async (
  leadId: string,
  record: unknown
): Promise<string | null> => {
  const client = getStorageClient()
  const bucketName = getBucketName()
  if (!client || !bucketName) {
    console.warn('[Lead] Storage not configured — cannot persist lead record')
    return null
  }

  // Date-partitioned so the bucket stays browsable as volume grows.
  const day = new Date().toISOString().slice(0, 10)
  const key = `leads/${day}/${leadId}.json`

  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(record, null, 2),
    ContentType: 'application/json',
    // Never cache a lead record.
    CacheControl: 'no-store'
  }))

  return key
}
