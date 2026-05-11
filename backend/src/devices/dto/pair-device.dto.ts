import { IsString, MinLength } from 'class-validator';

export class PairDeviceDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsString()
  @MinLength(1)
  pairingSecret!: string;
}
