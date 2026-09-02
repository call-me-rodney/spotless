import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Route } from './route.model';
import { Case } from '../../case/models/case.model';
import { RouteStopStatus } from '../types/enum.type';

// One visit on a run. Deliberately NOT paranoid: re-planning replaces a
// route's stops wholesale, and a soft-deleted row would keep occupying its
// slot in the unique indexes below. The Route is the durable artifact.
@Table({
    tableName: 'routeStops',
    indexes: [
        // Two stops cannot claim the same position in the run...
        { unique: true, fields: ['routeId', 'sequence'] },
        // ...and a case cannot appear twice on the same run.
        { unique: true, fields: ['routeId', 'caseId'] },
    ],
})
export class RouteStop extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @ForeignKey(() => Route)
    @Column({ type: DataType.UUID })
    declare routeId: string;

    @BelongsTo(() => Route)
    declare route: Route;

    // A real foreign key: unlike the old `cases` string array, a stop cannot
    // reference a case that does not exist.
    @ForeignKey(() => Case)
    @Column({ type: DataType.UUID })
    declare caseId: string;

    @BelongsTo(() => Case)
    declare case: Case;

    // Visit order, 1-based. This is the output of the optimiser.
    @Column({ type: DataType.INTEGER })
    declare sequence: number;

    // Cost of travelling from the previous stop (or the origin, for sequence 1).
    @AllowNull
    @Column({ type: DataType.INTEGER })
    declare legDistanceMeters: number;

    @AllowNull
    @Column({ type: DataType.INTEGER })
    declare legDurationSeconds: number;

    @AllowNull
    @Column({ type: DataType.DATE })
    declare estimatedArrival: Date;

    // Actuals, written by the crew app — the plan versus what happened.
    @AllowNull
    @Column({ type: DataType.DATE })
    declare arrivedAt: Date;

    @AllowNull
    @Column({ type: DataType.DATE })
    declare completedAt: Date;

    @Column({ type: DataType.STRING, defaultValue: RouteStopStatus.pending })
    declare status: RouteStopStatus;
}
