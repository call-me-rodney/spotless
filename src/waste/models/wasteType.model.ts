import { AllowNull, Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { hazardLevel } from "../types/enum.types";
import { WasteInstance } from "./wasteInstance.model";

// The curated taxonomy: plastic bottles, banana peels, polythene bags.
// paranoid so retiring a type never orphans the instances that reference it.
@Table({ tableName: "wasteTypes", paranoid: true })
export class WasteType extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    // Unique so the auto-create path in WasteService cannot fork the catalog.
    @Column({ type: DataType.STRING, unique: true })
    declare name: string;

    // Nullable: a type auto-created from a CNN label knows only its name,
    // and an admin fills in the rest afterwards.
    @AllowNull
    @Column({ type: DataType.STRING })
    declare description: string;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare material: string;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare hazardLevel: hazardLevel;

    @HasMany(() => WasteInstance)
    declare instances: WasteInstance[];
}
