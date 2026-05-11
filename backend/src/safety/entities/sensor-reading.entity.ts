import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'sensor_readings' })
@Index(['deviceId', 'createdAt'])
export class SensorReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 128 })
  deviceId!: string;

  @Column({ type: 'double precision' })
  temp!: number;

  @Column({ type: 'double precision' })
  gas!: number;

  @Column({ name: 'temp_avg', type: 'double precision' })
  tempAvg!: number;

  @Column({ name: 'gas_avg', type: 'double precision' })
  gasAvg!: number;

  @Column({ type: 'smallint' })
  phi!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
