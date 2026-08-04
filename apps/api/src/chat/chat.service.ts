import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ChatMessageView,
  ConversationDetail,
  ConversationSummary,
  Locale,
  TranslationStatus,
  UnreadMessagesCount,
} from '@agrobridge/shared';
import { canTrade, isLocale } from '@agrobridge/shared';
import { LocaleCode, Prisma, UserRole } from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/** Skip email if the peer opened the chat within this window (likely online). */
const CHAT_EMAIL_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const CHAT_EMAIL_PREVIEW_MAX = 180;
/** Translate at most this many missing messages per conversation load (newest first). */
const TRANSLATION_BACKFILL_LIMIT = 24;

const participantSelect = {
  id: true,
  displayName: true,
  role: true,
  locale: true,
} satisfies Prisma.UserSelect;

type Participant = {
  id: string;
  displayName: string | null;
  role: UserRole;
  locale: LocaleCode;
};

type MessageEntity = {
  id: string;
  conversationId: string;
  senderId: string;
  sourceLocale: LocaleCode;
  sourceText: string;
  createdAt: Date;
  translations: Array<{
    targetLocale: LocaleCode;
    translatedText: string | null;
    status: 'pending' | 'completed' | 'failed';
  }>;
};

type ConversationReadState = {
  id: string;
  farmerId: string;
  buyerId: string;
  farmerLastReadAt: Date | null;
  buyerLastReadAt: Date | null;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
    private readonly notifications: NotificationsService,
  ) {}

  async createOrGet(
    user: AuthenticatedUser,
    dto: CreateConversationDto,
  ): Promise<ConversationDetail> {
    const pair = await this.resolveParticipants(user, dto);
    const conversation = await this.prisma.conversation.upsert({
      where: {
        farmerId_buyerId: {
          farmerId: pair.farmerId,
          buyerId: pair.buyerId,
        },
      },
      create: {
        farmerId: pair.farmerId,
        buyerId: pair.buyerId,
      },
      update: {},
    });

    return this.getById(user, conversation.id);
  }

  async listMine(user: AuthenticatedUser): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ farmerId: user.id }, { buyerId: user.id }],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        farmer: { select: participantSelect },
        buyer: { select: participantSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            translations: true,
          },
        },
      },
    });

    const unreadById = await this.unreadCountsByConversation(user.id, conversations);

    return conversations.map((conversation) => {
      const peer = conversation.farmerId === user.id ? conversation.buyer : conversation.farmer;
      const last = conversation.messages[0]
        ? this.toMessageView(conversation.messages[0], user)
        : null;

      return {
        id: conversation.id,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        peer: this.toParticipant(peer),
        lastMessage: last,
        unreadCount: unreadById.get(conversation.id) ?? 0,
      };
    });
  }

  async unreadTotal(user: AuthenticatedUser): Promise<UnreadMessagesCount> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ farmerId: user.id }, { buyerId: user.id }],
      },
      select: {
        id: true,
        farmerId: true,
        buyerId: true,
        farmerLastReadAt: true,
        buyerLastReadAt: true,
      },
    });

    const unreadById = await this.unreadCountsByConversation(user.id, conversations);
    let count = 0;
    for (const value of unreadById.values()) {
      count += value;
    }
    return { count };
  }

  async getById(
    user: AuthenticatedUser,
    id: string,
    preferredLocale?: string,
  ): Promise<ConversationDetail> {
    const viewer = await this.resolveViewerLocale(user, preferredLocale);
    const conversation = await this.requireConversation(viewer, id);
    await this.markRead(viewer, conversation);

    const messages = await this.ensureViewerTranslations(
      await this.prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        include: { translations: true },
      }),
      viewer,
    );

    const peer =
      conversation.farmerId === viewer.id ? conversation.buyer : conversation.farmer;

    return {
      id: conversation.id,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      peer: this.toParticipant(peer),
      lastMessage: messages.length
        ? this.toMessageView(messages[messages.length - 1], viewer)
        : null,
      unreadCount: 0,
      messages: messages.map((message) => this.toMessageView(message, viewer)),
    };
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageView> {
    const sourceLocale =
      dto.sourceLocale && isLocale(dto.sourceLocale) ? dto.sourceLocale : user.locale;
    const sender =
      sourceLocale !== user.locale
        ? await this.resolveViewerLocale(user, sourceLocale)
        : user;

    const conversation = await this.requireConversation(sender, conversationId);
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Message text is required');
    }

    const peer =
      conversation.farmerId === sender.id ? conversation.buyer : conversation.farmer;
    const targetLocale = peer.locale as Locale;

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: sender.id,
        sourceLocale: sourceLocale as LocaleCode,
        sourceText: text,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.translationService.translateMessage({
      messageId: message.id,
      sourceText: text,
      sourceLocale,
      targetLocale,
    });

    const full = await this.prisma.message.findUniqueOrThrow({
      where: { id: message.id },
      include: { translations: true },
    });

    void this.notifyPeerAboutMessage(sender, conversation, text).catch(() => undefined);

    return this.toMessageView(full, sender);
  }

  private async notifyPeerAboutMessage(
    sender: AuthenticatedUser,
    conversation: ConversationReadState & {
      farmerId: string;
      buyerId: string;
    },
    text: string,
  ): Promise<void> {
    const peerId =
      conversation.farmerId === sender.id ? conversation.buyerId : conversation.farmerId;
    const peerLastReadAt =
      conversation.farmerId === peerId
        ? conversation.farmerLastReadAt
        : conversation.buyerLastReadAt;

    if (
      peerLastReadAt &&
      Date.now() - peerLastReadAt.getTime() < CHAT_EMAIL_ACTIVE_WINDOW_MS
    ) {
      return;
    }

    const peer = await this.prisma.user.findUnique({
      where: { id: peerId },
      select: {
        email: true,
        locale: true,
        displayName: true,
        blockedAt: true,
      },
    });
    if (!peer || peer.blockedAt) {
      return;
    }

    const preview =
      text.length > CHAT_EMAIL_PREVIEW_MAX
        ? `${text.slice(0, CHAT_EMAIL_PREVIEW_MAX - 1)}…`
        : text;

    await this.notifications.notifyChatMessage({
      recipient: {
        email: peer.email,
        locale: peer.locale,
        displayName: peer.displayName,
      },
      senderName: sender.displayName?.trim() || sender.email,
      preview,
      conversationId: conversation.id,
    });
  }

  private async markRead(user: AuthenticatedUser, conversation: ConversationReadState) {
    const now = new Date();
    if (conversation.farmerId === user.id) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { farmerLastReadAt: now },
      });
      return;
    }
    if (conversation.buyerId === user.id) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { buyerLastReadAt: now },
      });
    }
  }

  private async unreadCountsByConversation(
    userId: string,
    conversations: ConversationReadState[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const conversation of conversations) {
      counts.set(conversation.id, 0);
    }
    if (conversations.length === 0) {
      return counts;
    }

    const peerMessages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversations.map((item) => item.id) },
        senderId: { not: userId },
      },
      select: {
        conversationId: true,
        createdAt: true,
      },
    });

    const byId = new Map(conversations.map((item) => [item.id, item]));
    for (const message of peerMessages) {
      const conversation = byId.get(message.conversationId);
      if (!conversation) continue;
      const lastReadAt =
        conversation.farmerId === userId
          ? conversation.farmerLastReadAt
          : conversation.buyerLastReadAt;
      if (!lastReadAt || message.createdAt > lastReadAt) {
        counts.set(message.conversationId, (counts.get(message.conversationId) ?? 0) + 1);
      }
    }

    return counts;
  }

  private async resolveParticipants(user: AuthenticatedUser, dto: CreateConversationDto) {
    if (dto.rfqId) {
      const rfq = await this.prisma.rfq.findUnique({
        where: { id: dto.rfqId },
        include: { product: { select: { ownerUserId: true } } },
      });
      if (!rfq) {
        throw new NotFoundException('RFQ not found');
      }

      const isBuyer = rfq.buyerId === user.id;
      const isFarmer = rfq.product.ownerUserId === user.id;
      if (!isBuyer && !isFarmer && user.role !== 'admin') {
        throw new ForbiddenException('Not allowed to open chat for this RFQ');
      }

      return { farmerId: rfq.product.ownerUserId, buyerId: rfq.buyerId };
    }

    if (dto.purchaseRequestId) {
      const request = await this.prisma.purchaseRequest.findUnique({
        where: { id: dto.purchaseRequestId },
      });
      if (!request) {
        throw new NotFoundException('Purchase request not found');
      }

      const isBuyer = request.buyerId === user.id;
      const isSellerSide = canTrade(user.role) && user.id !== request.buyerId;

      if (isBuyer) {
        if (!dto.farmerId) {
          throw new BadRequestException('farmerId is required when buyer opens chat');
        }
        const farmer = await this.prisma.user.findUnique({ where: { id: dto.farmerId } });
        if (!farmer || !canTrade(farmer.role)) {
          throw new NotFoundException('Farmer not found');
        }
        return { farmerId: farmer.id, buyerId: request.buyerId };
      }

      if (isSellerSide) {
        return { farmerId: user.id, buyerId: request.buyerId };
      }

      throw new ForbiddenException('Not allowed to open chat for this purchase request');
    }

    if (dto.farmerId) {
      if (!canTrade(user.role)) {
        throw new ForbiddenException('Sign in to start chat with a farmer');
      }

      const farmer = await this.prisma.user.findUnique({ where: { id: dto.farmerId } });
      if (!farmer || !canTrade(farmer.role)) {
        throw new NotFoundException('Farmer not found');
      }

      return { farmerId: farmer.id, buyerId: user.role === 'admin' && dto.buyerId ? dto.buyerId : user.id };
    }

    if (dto.buyerId) {
      if (!canTrade(user.role)) {
        throw new ForbiddenException('Sign in to start chat with a buyer');
      }
      const buyer = await this.prisma.user.findUnique({ where: { id: dto.buyerId } });
      if (!buyer || !canTrade(buyer.role)) {
        throw new NotFoundException('Buyer not found');
      }
      return { farmerId: user.id, buyerId: buyer.id };
    }

    throw new BadRequestException('rfqId, purchaseRequestId, farmerId, or buyerId is required');
  }

  private async requireConversation(user: AuthenticatedUser, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        farmer: { select: participantSelect },
        buyer: { select: participantSelect },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.farmerId !== user.id &&
      conversation.buyerId !== user.id &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('Not allowed to access this conversation');
    }

    return conversation;
  }

  private toParticipant(user: Participant) {
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale as Locale,
    };
  }

  private async resolveViewerLocale(
    user: AuthenticatedUser,
    preferredLocale?: string,
  ): Promise<AuthenticatedUser> {
    if (!preferredLocale || !isLocale(preferredLocale) || preferredLocale === user.locale) {
      return user;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { locale: preferredLocale as LocaleCode },
    });

    return { ...user, locale: preferredLocale };
  }

  private async ensureViewerTranslations(
    messages: MessageEntity[],
    viewer: AuthenticatedUser,
  ): Promise<MessageEntity[]> {
    const viewerLocale = viewer.locale as LocaleCode;
    const needing = messages
      .filter((message) => {
        if (message.senderId === viewer.id) return false;
        if (message.sourceLocale === viewerLocale) return false;
        const existing = message.translations.find(
          (item) => item.targetLocale === viewerLocale,
        );
        return !(existing?.status === 'completed' && existing.translatedText);
      })
      .slice(-TRANSLATION_BACKFILL_LIMIT);

    if (needing.length === 0) {
      return messages;
    }

    await Promise.all(
      needing.map((message) =>
        this.translationService.translateMessage({
          messageId: message.id,
          sourceText: message.sourceText,
          sourceLocale: message.sourceLocale as Locale,
          targetLocale: viewer.locale,
        }),
      ),
    );

    const refreshed = await this.prisma.message.findMany({
      where: { conversationId: messages[0]!.conversationId },
      orderBy: { createdAt: 'asc' },
      include: { translations: true },
    });
    return refreshed as MessageEntity[];
  }

  private toMessageView(message: MessageEntity, viewer: AuthenticatedUser): ChatMessageView {
    const isMine = message.senderId === viewer.id;
    const viewerLocale = viewer.locale;

    if (isMine || message.sourceLocale === viewerLocale) {
      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
        sourceLocale: message.sourceLocale as Locale,
        sourceText: message.sourceText,
        displayText: message.sourceText,
        translationStatus: 'none',
        isMine,
      };
    }

    const translation = message.translations.find((item) => item.targetLocale === viewerLocale);
    if (!translation) {
      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
        sourceLocale: message.sourceLocale as Locale,
        sourceText: message.sourceText,
        displayText: message.sourceText,
        translationStatus: 'pending',
        isMine,
      };
    }

    const status = translation.status as TranslationStatus;
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
      sourceLocale: message.sourceLocale as Locale,
      sourceText: message.sourceText,
      displayText:
        status === 'completed' && translation.translatedText
          ? translation.translatedText
          : message.sourceText,
      translationStatus: status,
      isMine,
    };
  }
}
