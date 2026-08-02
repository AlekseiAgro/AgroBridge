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
} from '@agrobridge/shared';
import { LocaleCode, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
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
      };
    });
  }

  async getById(user: AuthenticatedUser, id: string): Promise<ConversationDetail> {
    const conversation = await this.requireConversation(user, id);
    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: { translations: true },
    });

    const peer =
      conversation.farmerId === user.id ? conversation.buyer : conversation.farmer;

    return {
      id: conversation.id,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      peer: this.toParticipant(peer),
      lastMessage: messages.length
        ? this.toMessageView(messages[messages.length - 1], user)
        : null,
      messages: messages.map((message) => this.toMessageView(message, user)),
    };
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageView> {
    const conversation = await this.requireConversation(user, conversationId);
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Message text is required');
    }

    const peer =
      conversation.farmerId === user.id ? conversation.buyer : conversation.farmer;
    const sourceLocale = user.locale;
    const targetLocale = peer.locale as Locale;

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
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

    return this.toMessageView(full, user);
  }

  private async resolveParticipants(user: AuthenticatedUser, dto: CreateConversationDto) {
    if (dto.rfqId) {
      const rfq = await this.prisma.rfq.findUnique({
        where: { id: dto.rfqId },
        include: { farm: true },
      });
      if (!rfq) {
        throw new NotFoundException('RFQ not found');
      }

      const isBuyer = rfq.buyerId === user.id;
      const isFarmer = rfq.farm.ownerId === user.id;
      if (!isBuyer && !isFarmer && user.role !== 'admin') {
        throw new ForbiddenException('Not allowed to open chat for this RFQ');
      }

      return { farmerId: rfq.farm.ownerId, buyerId: rfq.buyerId };
    }

    if (dto.farmerId) {
      if (user.role !== 'buyer' && user.role !== 'admin') {
        throw new ForbiddenException('Only buyers can start chat with a farmer this way');
      }

      const farmer = await this.prisma.user.findUnique({ where: { id: dto.farmerId } });
      if (!farmer || farmer.role !== 'farmer') {
        throw new NotFoundException('Farmer not found');
      }

      return { farmerId: farmer.id, buyerId: user.role === 'admin' && dto.buyerId ? dto.buyerId : user.id };
    }

    throw new BadRequestException('rfqId or farmerId is required');
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
