import { AllowNull, Column, Model, Table } from 'sequelize-typescript';
import type { Roles } from '../types/enum.type';

@Table
export class User extends Model {
  @Column
  declare firstName: string;

  @Column
  declare lastName: string;

  @Column
  declare email: string;

  @Column
  declare role: Roles;

  @AllowNull
  @Column
  declare collector: string;

  @Column
  declare password: string;

  @Column({ defaultValue: true })
  declare isActive: boolean;

  @Column({defaultValue: new Date()})
  declare createdAt: Date;

  @AllowNull
  @Column
  declare updatedAt: Date;

  //associations
  // users:cases 1:many
  // user:collector many:many
}
