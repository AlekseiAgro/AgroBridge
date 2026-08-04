import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles('buyer', 'farmer', 'admin')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.listMine(user);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.unreadTotal(user);
  }

  @Post()
  createOrGet(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.chatService.createOrGet(user, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ) {
    return this.chatService.getById(user, id, locale);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, id, dto);
  }
}
