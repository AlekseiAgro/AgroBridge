import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { isFarmDocumentMimeType } from '@agrobridge/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import { FarmsService } from './farms.service';

/** Percent-encodes everything outside the RFC 5987 attr-char set. */
function encodeFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Uploaded file names are user controlled, so the ASCII fallback drops everything that
 * could break out of the quoted string or inject a header.
 */
function attachmentHeader(fileName: string): string {
  const ascii = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .trim();
  return `attachment; filename="${ascii || 'document'}"; filename*=UTF-8''${encodeFileName(fileName)}`;
}

@Controller('farms/documents')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles('farmer', 'buyer', 'admin')
export class FarmDocumentsController {
  constructor(
    private readonly farmsService: FarmsService,
    private readonly storage: StorageService,
  ) {}

  @Get(':documentId/file')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.farmsService.getDocumentDownload(user, documentId);
    const stream = await this.storage.openReadStream(document.key);

    res.setHeader(
      'Content-Type',
      isFarmDocumentMimeType(document.mimeType) ? document.mimeType : 'application/octet-stream',
    );
    res.setHeader('Content-Disposition', attachmentHeader(document.fileName));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    stream.pipe(res);
  }
}
