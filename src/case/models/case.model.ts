import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Status, Priority } from '../types/enum.type';
import { User } from '../../users/models/user.model';

// paranoid: destroy() fills deletedAt instead of removing the row, so closed and
// rejected cases stay available to the analytics module.
@Table({ tableName: 'cases', paranoid: true })
export class Case extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @Column({ type: DataType.STRING })
    declare imagePath: string;

    @Column({ type: DataType.BOOLEAN, defaultValue: false })
    declare caseVerified: boolean;

    // Split out of the old `location` string so routing can do distance maths
    // and analytics can group by area without parsing.
    @Column({ type: DataType.DOUBLE })
    declare latitude: number;

    @Column({ type: DataType.DOUBLE })
    declare longitude: number;

    @Column({ type: DataType.DATE })
    declare timeTaken: Date;

    @ForeignKey(() => User)
    @Column({ type: DataType.UUID })
    declare reporterId: string;

    @BelongsTo(() => User)
    declare reporter: User;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare description: string;

    // Explicit `type` on the enum columns: a bare @Column would fall back to
    // design:type reflection, which cannot resolve an enum to a SQL type.
    @Column({ type: DataType.STRING, defaultValue: Status.pending })
    declare status: Status;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare priority: Priority;

    @AllowNull
    @Column({ type: DataType.DATE })
    declare closedAt: Date;

    // createdAt / updatedAt / deletedAt are managed by Sequelize (timestamps +
    // paranoid) — declaring them by hand froze the default at process start.
}
