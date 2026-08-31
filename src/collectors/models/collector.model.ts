import { Table, Model, Column, DataType } from 'sequelize-typescript';

@Table({tableName:'collectors'})
export class Collector extends Model {
    @Column({primaryKey:true, type: DataType.UUID, defaultValue: DataType.UUIDV4})
    declare id: string;

    @Column
    declare name: string;

    @Column
    declare address: string;

    @Column
    declare employeeCount: number;

    @Column
    declare averageRating: number;

    @Column({defaultValue: new Date()})
    declare createdAt: Date;

    @Column
    declare deletedAt: Date;
}