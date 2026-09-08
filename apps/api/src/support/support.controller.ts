import { Body, Controller, Post } from '@nestjs/common';
import type { SupportRequestResponse } from '@agrobridge/shared';
import { ClientIp } from '../http/client-ip';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  submit(
    @Body() body: CreateSupportRequestDto,
    @ClientIp() ip: string,
  ): Promise<SupportRequestResponse> {
    return this.support.submit(body, ip);
  }
}
