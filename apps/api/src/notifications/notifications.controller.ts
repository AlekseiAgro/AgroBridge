import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 30;
    return this.notifications.listMine(user.id, Number.isFinite(parsed) ? parsed : 30);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notifications.unreadCount(user.id);
    return { count };
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const item = await this.notifications.markRead(user.id, id);
    return item ?? { ok: false };
  }
}
