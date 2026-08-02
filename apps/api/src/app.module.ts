import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { FarmsModule } from './farms/farms.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RfqsModule } from './rfqs/rfqs.module';
import { StorageModule } from './storage/storage.module';
import { TranslationModule } from './translation/translation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    HealthModule,
    AuthModule,
    FarmsModule,
    ProductsModule,
    RfqsModule,
    TranslationModule,
    ChatModule,
    AdminModule,
  ],
})
export class AppModule {}
