import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { AlertDispatchProcessor, ALERTS_QUEUE } from './alert-dispatch.processor';
import { SafetyAlert } from './entities/safety-alert.entity';
import { SensorReading } from './entities/sensor-reading.entity';
import { MqttListenerService } from './mqtt-listener.service';
import { ReadingsPersistenceService } from './readings-persistence.service';
import { ReadingsQueryService } from './readings-query.service';
import { SensorBufferService } from './sensor-buffer.service';
import { SensorIngestController } from './sensor-ingest.controller';
import { SensorIngestService } from './sensor-ingest.service';
import { SafetyGateway } from './safety.gateway';
import { SafetyHistoryController } from './safety-history.controller';
import { SafetyInsightsService } from './safety-insights.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SafetyAlert, SensorReading]),
    DevicesModule,
    BullModule.registerQueue({
      name: ALERTS_QUEUE,
    }),
  ],
  controllers: [SafetyHistoryController, SensorIngestController],
  providers: [
    SensorBufferService,
    SensorIngestService,
    ReadingsPersistenceService,
    ReadingsQueryService,
    SafetyInsightsService,
    MqttListenerService,
    SafetyGateway,
    AlertDispatchProcessor,
  ],
})
export class SafetyModule {}
