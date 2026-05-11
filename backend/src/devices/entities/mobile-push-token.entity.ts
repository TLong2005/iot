import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mobile_push_tokens')
@Index(['deviceId'])
export class MobilePushToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id' })
  deviceId!: string;

  /** Expo push token (ExponentPushToken[...]); unique per app install */
  @Column({ name: 'expo_push_token', type: 'text', unique: true })
  expoPushToken!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
