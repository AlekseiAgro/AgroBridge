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
    return this.serveLocalFile(`products/${productId}/${filename}`, filename, res);
  }

  @Get('users/:userId/:filename')
  async serveUserAvatar(
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveLocalFile(`users/${userId}/${filename}`, filename, res);
  }

  @Get('farms/:farmId/photos/:filename')
  async serveFarmPhoto(
    @Param('farmId') farmId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveLocalFile(`farms/${farmId}/photos/${filename}`, filename, res);
  }

  @Get('farms/:farmId/documents/:filename')
  async serveFarmDocument(
    @Param('farmId') farmId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveLocalFile(`farms/${farmId}/documents/${filename}`, filename, res);
  }

  private serveLocalFile(key: string, filename: string, res: Response) {
    if (this.storage.getDriver() !== STORAGE_DRIVER.LOCAL) {
      throw new NotFoundException('Local uploads are not enabled');
    }

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
