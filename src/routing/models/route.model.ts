import { AllowNull, BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { Collector } from '../../collectors/models/collector.model';
import { RouteStop } from './routeStop.model';
import { RouteStatus, RouteProvider } from '../types/enum.type';

// A planned collection run: which organisation, on which day, in what order.
// paranoid because a completed run is the record of work done — analytics and
// any future SLA reporting need it long after the crew has moved on.
@Table({ tableName: 'routes', paranoid: true })
export class Route extends Model {
    @Column({ primaryKey: true, type: DataType.UUID, defaultValue: DataType.UUIDV4 })
    declare id: string;

    @Column({ type: DataType.STRING })
    declare name: string;

    @ForeignKey(() => Collector)
    @Column({ type: DataType.UUID })
    declare collectorId: string;

    @BelongsTo(() => Collector)
    declare collector: Collector;

    @Column({ type: DataType.STRING, defaultValue: RouteStatus.draft })
    declare status: RouteStatus;

    // The shift this run is for — a date, not an instant.
    @AllowNull
    @Column({ type: DataType.DATEONLY })
    declare plannedFor: string;

    // Where the run starts and returns to. Held on the route rather than read
    // from the collector, so a past plan still makes sense after the
    // organisation moves depot.
    @Column({ type: DataType.DOUBLE })
    declare originLatitude: number;

    @Column({ type: DataType.DOUBLE })
    declare originLongitude: number;

    // Explicit units. The previous model called these `length` and `estTime`,
    // which said nothing about metres vs km or seconds vs minutes.
    @AllowNull
    @Column({ type: DataType.INTEGER })
    declare totalDistanceMeters: number;

    @AllowNull
    @Column({ type: DataType.INTEGER })
    declare totalDurationSeconds: number;

    // Google's encoded polyline, for drawing the run without re-calling them.
    // Treat as a refreshable cache, not a permanent record — Google's terms
    // limit how long their response content may be retained.
    @AllowNull
    @Column({ type: DataType.TEXT })
    declare encodedPolyline: string;

    @AllowNull
    @Column({ type: DataType.STRING })
    declare provider: RouteProvider;

    @AllowNull
    @Column({ type: DataType.DATE })
    declare optimizedAt: Date;

    @HasMany(() => RouteStop)
    declare stops: RouteStop[];
}
