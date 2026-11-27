import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  buildS3PublicUrl,
  detectImageFormat,
  getUploadObject,
  isS3ProxyEnabled,
  MAX_UPLOAD_BYTES,
  parseMultipartImageUpload,
  uploadImageBuffer,
  UploadValidationError,
} from '../server/storage.ts';

function buildMultipartRequest(boundary: string, filename: string, mimeType: string, payload: Buffer) {
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf-8',
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([header, payload, footer]);
  const stream = Readable.from([body]) as unknown as import('node:http').IncomingMessage;
  stream.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  };
  return stream;
}

test('detectImageFormat checks JPG, PNG, and WebP magic bytes and rejects invalid signatures', () => {
  assert.deepEqual(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])), {
    ext: 'jpg',
    contentType: 'image/jpeg',
  });
  assert.deepEqual(
    detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    { ext: 'png', contentType: 'image/png' },
  );
  assert.deepEqual(detectImageFormat(Buffer.from('RIFF1234WEBP', 'ascii')), {
    ext: 'webp',
    contentType: 'image/webp',
  });
  assert.equal(detectImageFormat(Buffer.from('<svg></svg>', 'utf-8')), null);
});

test('parseMultipartImageUpload parses valid PNG stream and rejects spoofed or oversized payloads', async () => {
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  const okReq = buildMultipartRequest('testbound1', 'panel.png', 'image/png', validPng);
  const parsed = await parseMultipartImageUpload(okReq);
  assert.equal(parsed.format.ext, 'png');
  assert.equal(parsed.buffer.equals(validPng), true);

  const spoofedReq = buildMultipartRequest(
    'testbound2',
    'fake.jpg',
    'image/jpeg',
    Buffer.from('not-actually-a-jpg', 'utf-8'),
  );
  await assert.rejects(() => parseMultipartImageUpload(spoofedReq), (err) => {
    assert.ok(err instanceof UploadValidationError);
    assert.equal(err.statusCode, 400);
    return true;
  });

  const tooBig = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(MAX_UPLOAD_BYTES + 128, 0x41),
  ]);
  const bigReq = buildMultipartRequest('testbound3', 'huge.jpg', 'image/jpeg', tooBig);
  await assert.rejects(() => parseMultipartImageUpload(bigReq), (err) => {
    assert.ok(err instanceof UploadValidationError);
    assert.match(err.message, /4 МБ/);
    return true;
  });
});

test('buildS3PublicUrl formats public URLs with custom CDN, endpoint, or AWS defaults', () => {
  const prevPublic = process.env.S3_PUBLIC_URL;
  const prevEndpoint = process.env.S3_ENDPOINT;
  const prevBucket = process.env.S3_BUCKET;
  const prevRegion = process.env.S3_REGION;

  try {
    process.env.S3_BUCKET = 'ec-media';
    process.env.S3_REGION = 'eu-central-1';
    process.env.S3_PUBLIC_URL = 'https://cdn.energocomfort.shop/';
    assert.equal(buildS3PublicUrl('uploads/a.jpg'), 'https://cdn.energocomfort.shop/uploads/a.jpg');

    delete process.env.S3_PUBLIC_URL;
    process.env.S3_ENDPOINT = 'https://storage.railway.app/';
    assert.equal(buildS3PublicUrl('uploads/a.jpg'), 'https://storage.railway.app/ec-media/uploads/a.jpg');

    delete process.env.S3_ENDPOINT;
    assert.equal(buildS3PublicUrl('uploads/a.jpg'), 'https://ec-media.s3.eu-central-1.amazonaws.com/uploads/a.jpg');
  } finally {
    if (prevPublic === undefined) delete process.env.S3_PUBLIC_URL;
    else process.env.S3_PUBLIC_URL = prevPublic;
    if (prevEndpoint === undefined) delete process.env.S3_ENDPOINT;
    else process.env.S3_ENDPOINT = prevEndpoint;
    if (prevBucket === undefined) delete process.env.S3_BUCKET;
    else process.env.S3_BUCKET = prevBucket;
    if (prevRegion === undefined) delete process.env.S3_REGION;
    else process.env.S3_REGION = prevRegion;
  }
});

test('uploadImageBuffer falls back to local disk when S3 env vars are unset', async () => {
  const prevBucket = process.env.S3_BUCKET;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-upload-test-'));

  try {
    delete process.env.S3_BUCKET;

    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = await uploadImageBuffer(jpg, { uploadsDir: tempDir });
    assert.equal(res.storage, 'disk');
    assert.match(res.url, /^\/uploads\/project-.*\.jpg$/);

    const writtenPath = path.join(tempDir, res.key);
    assert.equal(fs.existsSync(writtenPath), true);
  } finally {
    if (prevBucket === undefined) delete process.env.S3_BUCKET;
    else process.env.S3_BUCKET = prevBucket;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('S3 proxy mode needs S3 config plus S3_PROXY_UPLOADS=true, and rejects unsafe filenames', async () => {
  const saved = { ...process.env };
  try {
    process.env.S3_BUCKET = 'b';
    process.env.S3_ACCESS_KEY_ID = 'k';
    process.env.S3_SECRET_ACCESS_KEY = 's';
    delete process.env.S3_PROXY_UPLOADS;
    assert.equal(isS3ProxyEnabled(), false);
    process.env.S3_PROXY_UPLOADS = 'true';
    assert.equal(isS3ProxyEnabled(), true);
    for (const bad of ['../secret.png', 'a/b.png', 'x.svg', '.hidden.png', 'x.png/../y']) {
      assert.equal(await getUploadObject(bad), null, bad);
    }
    delete process.env.S3_BUCKET;
    assert.equal(isS3ProxyEnabled(), false);
  } finally {
    process.env = saved;
  }
});
