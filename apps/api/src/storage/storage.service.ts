import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, promises as fs } from 'fs';
import { dirname, extname, join, resolve, sep } from 'path';
import type { Readable } from 'stream';
import {
  STORAGE_DRIVER,
  type StorageDriver,
  type StorageVisibility,
} from './storage.constants';
import {
  resolveObjectVisibility,
  resolveS3Buckets,
  resolveS3PublicBaseUrl,
  s3BucketForVisibility,
  storedObjectUrl,
  visibilityFromStorageKey,
  type S3BucketPair,
} from './storage-location';

export type StoredObject = {
  key: string;
  /**
   * Public fetch URL for `visibility: 'public'`. Empty for private objects —
   * callers must use an authorized download path, never `/api/uploads/...`.
   */
  url: string;
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly localDir: string;
  private readonly publicBaseUrl: string;
  private readonly s3Buckets?: S3BucketPair;
  private readonly s3Client?: S3Client;

  constructor(private readonly config: ConfigService) {
    const driver = (this.config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();
    this.driver =
      driver === STORAGE_DRIVER.S3 ? STORAGE_DRIVER.S3 : STORAGE_DRIVER.LOCAL;

    this.localDir = resolve(
      this.config.get<string>('STORAGE_LOCAL_DIR') ?? join(process.cwd(), 'uploads'),
    );

    this.publicBaseUrl = '';

    if (this.driver === STORAGE_DRIVER.S3) {
      this.publicBaseUrl = resolveS3PublicBaseUrl(
        this.config.get<string>('STORAGE_PUBLIC_BASE_URL'),
      );
      this.s3Buckets = resolveS3Buckets({
        publicBucket: this.config.get<string>('S3_PUBLIC_BUCKET'),
        legacyBucket: this.config.get<string>('S3_BUCKET'),
        privateBucket: this.config.get<string>('S3_PRIVATE_BUCKET'),
      });

      const region = this.config.get<string>('S3_REGION') ?? 'auto';
      const endpoint = this.config.get<string>('S3_ENDPOINT') ?? undefined;
      const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID') ?? undefined;
      const secretAccessKey =
        this.config.get<string>('S3_SECRET_ACCESS_KEY') ?? undefined;

      this.s3Client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined,
      });
    }
  }

  async onModuleInit() {
    if (this.driver === STORAGE_DRIVER.LOCAL) {
      await fs.mkdir(this.localDir, { recursive: true });
      this.logger.log(`Local storage ready at ${this.localDir}`);
    } else {
      this.logger.log(
        `S3 storage ready (public=${this.s3Buckets!.publicBucket} private=${this.s3Buckets!.privateBucket})`,
      );
    }
  }

  getDriver(): StorageDriver {
    return this.driver;
  }

  async upload(params: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    folder: string;
    visibility: StorageVisibility;
  }): Promise<StoredObject> {
    const extension = this.extensionFor(params.mimeType, params.originalName);
    const key = `${params.folder.replace(/^\/+|\/+$/g, '')}/${randomUUID()}${extension}`;
    const visibility = this.requireMatchingVisibility(key, params.visibility);

    if (this.driver === STORAGE_DRIVER.LOCAL) {
      const absolute = this.resolveLocalPath(key);
      await fs.mkdir(dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, params.buffer);
      return { key, url: this.urlFor(key, visibility) };
    }

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.s3BucketFor(visibility),
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
      }),
    );

    return { key, url: this.urlFor(key, visibility) };
  }

  /** Public objects get a fetchable URL; private objects never do. */
  private urlFor(key: string, visibility: StorageVisibility): string {
    return storedObjectUrl({
      key,
      visibility,
      driver: this.driver,
      publicBaseUrl: this.publicBaseUrl,
    });
  }

  async delete(key: string, visibility?: StorageVisibility): Promise<void> {
    if (!key) {
      return;
    }

    const resolved = visibility
      ? this.requireMatchingVisibility(key, visibility)
      : resolveObjectVisibility(key);

    if (this.driver === STORAGE_DRIVER.LOCAL) {
      const absolute = this.resolveLocalPath(key);
      try {
        await fs.unlink(absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      return;
    }

    await this.s3Client!.send(
      new DeleteObjectCommand({
        Bucket: this.s3BucketFor(resolved),
        Key: key,
      }),
    );
  }

  /**
   * Reads a stored object by its storage key. Callers must authorize access first.
   * Private downloads (farm verification documents, product certificates) must pass
   * `visibility: 'private'` so the object is always fetched from `S3_PRIVATE_BUCKET`,
   * never the public media bucket.
   */
  async openReadStream(key: string, visibility?: StorageVisibility): Promise<Readable> {
    const resolved = visibility
      ? this.requireMatchingVisibility(key, visibility)
      : resolveObjectVisibility(key);

    if (this.driver === STORAGE_DRIVER.LOCAL) {
      const absolute = this.resolveLocalPath(key);
      if (!existsSync(absolute)) {
        throw new NotFoundException('File not found');
      }
      return createReadStream(absolute);
    }

    try {
      const result = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.s3BucketFor(resolved),
          Key: key,
        }),
      );
      if (!result.Body) {
        throw new NotFoundException('File not found');
      }
      return result.Body as Readable;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const name = (error as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  resolveLocalPath(key: string): string {
    if (!key || key.includes('\0') || key.includes('..')) {
      throw new BadRequestException('Invalid storage key');
    }
    const absolute = resolve(this.localDir, key);
    if (!absolute.startsWith(this.localDir + sep) && absolute !== this.localDir) {
      throw new BadRequestException('Invalid storage key');
    }
    return absolute;
  }

  /**
   * Private object keys always map to the private bucket. A caller that asks
   * for the opposite visibility is rejected before any S3 call.
   */
  private requireMatchingVisibility(
    key: string,
    requested: StorageVisibility,
  ): StorageVisibility {
    const fromKey = visibilityFromStorageKey(key);
    if (fromKey !== requested) {
      throw new BadRequestException('Storage visibility does not match object key');
    }
    return requested;
  }

  private s3BucketFor(visibility: StorageVisibility): string {
    return s3BucketForVisibility(visibility, this.s3Buckets!);
  }

  private extensionFor(mimeType: string, originalName: string): string {
    const fromMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    if (fromMime[mimeType]) {
      return fromMime[mimeType];
    }
    const fromName = extname(originalName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(fromName)) {
      return fromName === '.jpeg' ? '.jpg' : fromName;
    }
    return '.bin';
  }
}
