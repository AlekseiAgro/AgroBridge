import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import { STORAGE_DRIVER } from './storage.constants';
import { StorageService } from './storage.service';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Get('products/:productId/:filename')
  async serveProductImage(
    @Param('productId') productId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (this.storage.getDriver() !== STORAGE_DRIVER.LOCAL) {
      throw new NotFoundException('Local uploads are not enabled');
    }

    const key = `products/${productId}/${filename}`;
    const absolute = this.storage.resolveLocalPath(key);
    if (!existsSync(absolute)) {
      throw new NotFoundException('File not found');
    }

    const contentType = CONTENT_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(absolute).pipe(res);
  }
}
