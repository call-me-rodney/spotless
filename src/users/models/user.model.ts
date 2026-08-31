import { AllowNull, BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import type { Roles } from '../types/enum.type';
import { Collector } from '../../collectors/models/collector.model';
import { Case } from '../../case/models/case.model';

@Table
export class User extends Model {
  @Column({primaryKey:true, type: DataType.UUID, defaultValue: DataType.UUIDV4})
  declare id: string;

  @Column
  declare firstName: string;

  @Column
  declare lastName: string;

  @Column
  declare email: string;

  @Column
  declare role: Roles;

  // Nullable: a citizen spotter belongs to no organisation.
  @AllowNull
  @ForeignKey(() => Collector)
  @Column({ type: DataType.UUID })
  declare collectorId: string;

  @BelongsTo(() => Collector)
  declare collector: Collector;

  @Column
  declare password: string;

  @Column({ defaultValue: true })
  declare isActive: boolean;

  // The cases this user has reported. The FK is named `reporterId`, so it has
  // to be stated — the convention default would look for `userId`.
  @HasMany(() => Case, 'reporterId')
  declare cases: Case[];

  // createdAt / updatedAt are managed by Sequelize. They were declared by hand
  // with `defaultValue: new Date()`, which evaluates once at module load and
  // stamped every row with the server's boot time.
}
