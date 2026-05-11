import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  pairingSecret!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(24, { message: 'expoPushToken looks invalid' })
  expoPushToken!: string;
}
