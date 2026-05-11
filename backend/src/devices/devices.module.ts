import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { MobilePushToken } from './entities/mobile-push-token.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { ExpoPushService } from './expo-push.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, MobilePushToken])],
  controllers: [DevicesController],
  providers: [DevicesService, ExpoPushService],
  exports: [DevicesService, ExpoPushService],
})
export class DevicesModule {}
