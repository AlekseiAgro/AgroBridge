import { Module } from '@nestjs/common';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';
import { VerificationCodeService } from './verification-code.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, GeorgiaCompanyRegistryService, VerificationCodeService],
  exports: [VerificationService, GeorgiaCompanyRegistryService, VerificationCodeService],
})
export class VerificationModule {}
