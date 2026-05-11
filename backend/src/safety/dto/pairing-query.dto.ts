import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class PairingQueryDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsString()
  @MinLength(1)
  pairingSecret!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(2000)
  limit?: number;
}
