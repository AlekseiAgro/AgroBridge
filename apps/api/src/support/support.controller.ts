import { Body, Controller, Post } from '@nestjs/common';
import type { SupportRequestResponse } from '@agrobridge/shared';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  submit(@Body() body: CreateSupportRequestDto): Promise<SupportRequestResponse> {
    return this.support.submit(body);
  }
}
