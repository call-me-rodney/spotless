import { AllowNull, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from '../../users/models/user.model';
import { Case } from '../../case/models/case.model';

// An organisation that responds to cases and collects waste.
// paranoid so retiring an organisation keeps its history intact for analytics.
@Table({ tableName: 'collectors', paranoid: true })
export class Collector extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @Column({ type: DataType.STRING, unique: true })
    declare name: string;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare address: string;

    @AllowNull
    @Column({ type: DataType.INTEGER })
    declare employeeCount: number;

    // FLOAT, not INTEGER — a rating of 4.5 has to survive the round trip.
    @AllowNull
    @Column({ type: DataType.FLOAT })
    declare averageRating: number;

    // The crews and admins employed by this organisation.
    @HasMany(() => User)
    declare staff: User[];

    // Cases this organisation has been dispatched to clear.
    @HasMany(() => Case)
    declare cases: Case[];
}
