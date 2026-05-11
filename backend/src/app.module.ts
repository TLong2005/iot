import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { RedisIoModule } from './redis/redis.module';
import { Device } from './devices/entities/device.entity';
import { MobilePushToken } from './devices/entities/mobile-push-token.entity';
import { DevicesModule } from './devices/devices.module';
import { SafetyAlert } from './safety/entities/safety-alert.entity';
import { SensorReading } from './safety/entities/sensor-reading.entity';
import { SafetyModule } from './safety/safety.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        entities: [SafetyAlert, SensorReading, Device, MobilePushToken],
        synchronize: config.get<boolean>('db.sync'),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    RedisIoModule,
    DevicesModule,
    SafetyModule,
  ],
})
export class AppModule {}
