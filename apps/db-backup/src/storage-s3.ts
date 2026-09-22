import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { BackupObjectStore, ObjectHead } from './types';
import { BackupError } from './types';

export type S3BackupStoreOptions = {
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
};

export function createS3BackupClient(options: S3BackupStoreOptions): S3Client {
  return new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: Boolean(options.endpoint),
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
}

export class S3BackupStore implements BackupObjectStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch {
      throw new BackupError('upload', 'Failed to upload backup object');
    }
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return { key, sizeBytes: result.ContentLength ?? 0 };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotFound' || name === 'NoSuchKey' || name === 'NotFoundError') {
        return null;
      }
      throw new BackupError('upload_verify', 'Failed to verify uploaded backup object');
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!result.Body) {
        return null;
      }
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NoSuchKey' || name === 'NotFound') {
        return null;
      }
      throw new BackupError('manifest', 'Failed to read backup object');
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      throw new BackupError('retention', 'Failed to delete expired backup object');
    }
  }
}

export function requireS3Options(r2: {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  region: string;
}): S3BackupStoreOptions {
  if (!r2.accessKeyId || !r2.secretAccessKey || !r2.bucket) {
    throw new BackupError(
      'config',
      'BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID, and BACKUP_R2_SECRET_ACCESS_KEY are required for S3 storage',
    );
  }
  return {
    endpoint: r2.endpoint,
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    bucket: r2.bucket,
    region: r2.region,
  };
}
