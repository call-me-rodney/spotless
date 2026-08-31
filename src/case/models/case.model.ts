import { AllowNull, Column, DataType, Model, Table } from 'sequelize-typescript';
import type { Status, Priority } from '../types/enum.type';

@Table({tableName:'cases'})
export class Case extends Model {
    @Column({primaryKey:true, type: DataType.UUID, defaultValue: DataType.UUIDV4})
    declare id: string;

    @Column
    declare imagePath: string;

    @AllowNull
    @Column
    declare caseVerified: boolean;

    @Column
    declare location: string;

    @Column
    declare timeTaken: Date;

    @Column
    declare reporter: string;

    @AllowNull
    @Column
    declare description: string;

    @Column
    declare status: Status;

    @AllowNull
    @Column
    declare priority: Priority;

    @Column({defaultValue: new Date()})
    declare createdAt: Date;

    @Column({defaultValue: new Date()})
    declare updatedAt: Date;

    @Column
    declare closedAt: Date;

    @Column
    declare deletedAt: Date;
}
