import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { DatabaseModule } from './database/database.module';
import { WorkoutModule } from './features/workout/workout.module';
import { UserModule } from './features/user/user.module';
import { PrismaService } from './database/prisma.service';

@Module({
  imports: [
    DatabaseModule,
    CqrsModule.forRoot(),
    ClsModule.forRoot({
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
          }),
        }),
      ],
    }),
    WorkoutModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
