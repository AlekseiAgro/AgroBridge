import { Module } from '@nestjs/common';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, GeorgiaCompanyRegistryService],
  exports: [VerificationService, GeorgiaCompanyRegistryService],
})
export class VerificationModule {}
