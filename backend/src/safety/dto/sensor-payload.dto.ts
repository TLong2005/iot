import { Expose, Transform, Type } from 'class-transformer';
import { IsNumber, IsString, MinLength } from 'class-validator';

export class SensorPayloadDto {
  /** MQTT/HTTP: nhận snake_case `device_id` (khuyến nghị firmware) hoặc camelCase `deviceId`. */
  @Expose()
  @Transform(({ obj }) => {
    const o = obj as Record<string, unknown>;
    if (typeof o.device_id === 'string' && o.device_id.length > 0) {
      return o.device_id;
    }
    if (typeof o.deviceId === 'string' && o.deviceId.length > 0) {
      return o.deviceId;
    }
    return o.device_id ?? o.deviceId ?? '';
  })
  @IsString()
  @MinLength(1)
  device_id!: string;

  @Type(() => Number)
  @IsNumber()
  temp!: number;

  @Type(() => Number)
  @IsNumber()
  gas!: number;
}
