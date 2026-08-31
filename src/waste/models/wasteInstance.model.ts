import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { WasteType } from "./wasteType.model";
import { Case } from "../../case/models/case.model";

// One row per detection: "the CNN found N of this waste type in this case".
// Counting how often a type appears is then a GROUP BY over these rows.
@Table({ tableName: "wasteInstances", paranoid: true })
export class WasteInstance extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @ForeignKey(() => WasteType)
    @Column({ type: DataType.UUID })
    declare wasteTypeId: string;

    @BelongsTo(() => WasteType)
    declare wasteType: WasteType;

    // Replaces the old `cases` array — one detection belongs to one case.
    @ForeignKey(() => Case)
    @Column({ type: DataType.UUID })
    declare caseId: string;

    @BelongsTo(() => Case)
    declare case: Case;

    @Column({ type: DataType.INTEGER, defaultValue: 1 })
    declare quantity: number;

    // Redundant with the parent case's latitude/longitude; kept nullable so
    // existing rows survive. Prefer reading position from the case.
    @AllowNull
    @Column({ type: DataType.STRING })
    declare location: string;

    // When the detection was made, defaulted to ingestion time by the service.
    @Column({ type: DataType.DATE })
    declare date: Date;
}
