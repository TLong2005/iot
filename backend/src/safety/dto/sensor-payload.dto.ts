import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class SensorPayloadDto {
  @IsString()
  device_id!: string;

  @Type(() => Number)
  @IsNumber()
  temp!: number;

  @Type(() => Number)
  @IsNumber()
  gas!: number;
}
