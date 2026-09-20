import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { NotificationUnreadSummary } from '@agrobridge/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import { MarkNotificationTypesReadDto } from './dto/mark-types-read.dto';

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
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<NotificationUnreadSummary> {
    return this.notifications.unreadSummary(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post('read-types')
  markTypesRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkNotificationTypesReadDto,
  ) {
    return this.notifications.markTypesRead(user.id, dto.types);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const item = await this.notifications.markRead(user.id, id);
    return item ?? { ok: false };
  }
}
