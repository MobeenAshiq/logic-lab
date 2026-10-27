import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppException } from '../common/app-exception';
import { Env } from '../config/env';

export const PRESIGN_TTL_SECONDS = 10 * 60;

/**
 * Cloudflare R2 through the S3 API. Files are private; access is only through
 * presigned URLs that expire in 10 minutes.
 */
@Injectable()
export class R2Service {
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', {
      infer: true,
    });
    this.bucket = config.get('R2_BUCKET', { infer: true }) ?? '';
    this.client =
      accountId && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
            // Newer SDKs add a CRC32 of the (empty) body to presigned upload
            // URLs, which R2 then rejects when the browser sends the real file.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
          })
        : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** The signed URL only accepts this exact content type and size. */
  getUploadUrl(key: string, contentType: string, contentLength: number) {
    return getSignedUrl(
      this.requireClient(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
  }

  /** With `downloadAs`, the browser saves the file under that name instead of opening it. */
  getDownloadUrl(key: string, downloadAs?: string) {
    return getSignedUrl(
      this.requireClient(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: downloadAs
          ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadAs)}`
          : undefined,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
  }

  // --- Multipart upload (large videos): the browser PUTs each part to a presigned URL. ---

  async createMultipartUpload(key: string, contentType: string) {
    const res = await this.requireClient().send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    if (!res.UploadId) throw new Error('R2 did not return an UploadId');
    return res.UploadId;
  }

  getUploadPartUrl(key: string, uploadId: string, partNumber: number) {
    return getSignedUrl(
      this.requireClient(),
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ) {
    await this.requireClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    await this.requireClient().send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async deleteObject(key: string) {
    await this.requireClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Size in bytes, or null if the object does not exist. */
  async objectSize(key: string): Promise<number | null> {
    try {
      const res = await this.requireClient().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return res.ContentLength ?? 0;
    } catch (err) {
      if (
        err instanceof S3ServiceException &&
        err.$metadata.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  /** Server-side upload (e.g. generated invoice PDFs). */
  async putObject(key: string, body: Uint8Array, contentType: string) {
    await this.requireClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.requireClient().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Empty R2 object: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  /** True if the object was actually uploaded. */
  async exists(key: string): Promise<boolean> {
    return (await this.objectSize(key)) !== null;
  }

  /** Signs many keys at once; returns {} when storage is not configured. */
  async getDownloadUrls(keys: Iterable<string>) {
    if (!this.client) return {};
    const unique = [...new Set(keys)];
    const urls = await Promise.all(unique.map((k) => this.getDownloadUrl(k)));
    return Object.fromEntries(unique.map((k, i) => [k, urls[i]]));
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
      );
    }
    return this.client;
  }
}
