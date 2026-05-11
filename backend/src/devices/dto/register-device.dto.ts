import { IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsString()
  @MinLength(4)
  pairingSecret!: string;
}
