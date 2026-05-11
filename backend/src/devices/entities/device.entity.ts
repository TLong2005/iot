import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', unique: true })
  deviceId!: string;

  @Column({ name: 'secret_hash' })
  secretHash!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
