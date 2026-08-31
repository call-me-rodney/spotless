import { Column, DataType, Model, Table } from "sequelize-typescript";
import type { hazardLevel } from "../types/enum.types";

@Table({ tableName: "wasteTypes" })
export class Waste extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @Column
    declare name: string;

    @Column
    declare description: string;

    @Column
    declare material: string;

    @Column
    declare hazardLevel: hazardLevel;

    @Column
    declare createdAt: Date;

    @Column
    declare updatedAt: Date;

    @Column
    declare deletedAt: Date;
}
