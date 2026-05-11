import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'safety_alerts' })
export class SafetyAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 128 })
  deviceId!: string;

  @Column({ name: 'temp_avg', type: 'double precision' })
  tempAvg!: number;

  @Column({ name: 'gas_avg', type: 'double precision' })
  gasAvg!: number;

  /** φ: 1 = emergency per specification */
  @Column({ type: 'smallint' })
  phi!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
