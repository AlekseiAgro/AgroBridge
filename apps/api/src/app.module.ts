import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CabinetModule } from './cabinet/cabinet.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { FarmsModule } from './farms/farms.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RatingsModule } from './ratings/ratings.module';
import { PurchaseRequestsModule } from './purchase-requests/purchase-requests.module';
import { RfqsModule } from './rfqs/rfqs.module';
import { SmsModule } from './sms/sms.module';
import { StorageModule } from './storage/storage.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SupportModule } from './support/support.module';
import { TranslationModule } from './translation/translation.module';
import { PlacesModule } from './places/places.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    SmsModule,
    HealthModule,
    AuthModule,
    FarmsModule,
    ProductsModule,
    CategoriesModule,
    PlacesModule,
    RfqsModule,
    PurchaseRequestsModule,
    SubscriptionsModule,
    VerificationModule,
    TranslationModule,
    ChatModule,
    AdminModule,
    RatingsModule,
    UsersModule,
    CabinetModule,
    SupportModule,
    NotificationsModule,
  ],
})
export class AppModule {}

