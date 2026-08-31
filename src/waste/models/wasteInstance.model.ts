import { Table, Column, Model, DataType } from "sequelize-typescript";

@Table({ tableName: "wasteInstances" })
export class WasteInstance extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @Column
    declare wasteTypeId: string;

    @Column
    declare quantity: number;

    @Column
    declare location: string;

    @Column
    declare date: Date;

    @Column(DataType.ARRAY(DataType.UUID))
    declare cases: string[];

    @Column
    declare updatedAt: Date;

    @Column
    declare deletedAt: Date;
}