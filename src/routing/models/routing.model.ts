import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({tableName:'routings'})
export class Routing extends Model {
    @Column({primaryKey:true, type: DataType.UUID, defaultValue: DataType.UUIDV4})
    declare id: string;

    @Column
    declare name: string;

    @Column({type: DataType.ARRAY(DataType.STRING)})
    declare cases: string[];

    @Column
    declare length: number;

    @Column
    declare estTime: number;
}