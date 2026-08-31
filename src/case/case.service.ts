import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Case } from './models/case.model';
import { User } from '../users/models/user.model';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { Status, Priority } from './types/enum.type';

@Injectable()
export class CaseService {
  constructor(@InjectModel(Case) private caseModel: typeof Case) {}

  // Joined on every read. The explicit attribute list keeps the reporter's
  // password hash from ever reaching a response body.
  private readonly reporterInclude = {
    model: User,
    attributes: ['id', 'firstName', 'lastName', 'email'],
  };

  async create(createCaseDto: CreateCaseDto, imagePath: string): Promise<Case> {
    const latitude = this.toCoordinate(createCaseDto.latitude, 'latitude', 90);
    const longitude = this.toCoordinate(createCaseDto.longitude, 'longitude', 180);

    if (!createCaseDto.reporterId) {
      throw new BadRequestException("'reporterId' is required");
    }

    try {
      return await this.caseModel.create({
        imagePath,
        latitude,
        longitude,
        reporterId: createCaseDto.reporterId,
        timeTaken: this.toTimestamp(createCaseDto.timeTaken),
        description: createCaseDto.description,
        status: Status.pending,
        caseVerified: false,
      } as any);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to create case');
    }
  }

  async findAll(): Promise<Case[]> {
    try {
      return await this.caseModel.findAll({
        include: [this.reporterInclude],
        order: [['createdAt', 'DESC']],
      });
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve cases');
    }
  }

  async findOne(id: string): Promise<Case> {
    try {
      const found = await this.caseModel.findByPk(id, { include: [this.reporterInclude] });
      if (!found) {
        throw new NotFoundException(`Case '${id}' not found`);
      }
      return found;
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve case');
    }
  }

  async update(id: string, updateCaseDto: UpdateCaseDto): Promise<Case> {
    try {
      const found = await this.caseModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Case '${id}' not found`);
      }

      const changes: Partial<Case> = {};
      if (updateCaseDto.latitude !== undefined) {
        changes.latitude = this.toCoordinate(updateCaseDto.latitude, 'latitude', 90);
      }
      if (updateCaseDto.longitude !== undefined) {
        changes.longitude = this.toCoordinate(updateCaseDto.longitude, 'longitude', 180);
      }
      if (updateCaseDto.timeTaken !== undefined) {
        changes.timeTaken = this.toTimestamp(updateCaseDto.timeTaken);
      }
      if (updateCaseDto.description !== undefined) {
        changes.description = updateCaseDto.description;
      }
      if (updateCaseDto.priority !== undefined) {
        changes.priority = this.toEnum(updateCaseDto.priority, Priority, 'priority');
      }
      if (updateCaseDto.caseVerified !== undefined) {
        changes.caseVerified = this.toBoolean(updateCaseDto.caseVerified, 'caseVerified');
      }
      if (updateCaseDto.status !== undefined) {
        changes.status = this.toEnum(updateCaseDto.status, Status, 'status');
        // Stamp the closing time once, so reopening and re-closing does not
        // silently rewrite the original resolution time.
        if (changes.status === Status.closed && !found.closedAt) {
          changes.closedAt = new Date();
        }
      }

      return await found.update(changes);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to update case');
    }
  }

  // paranoid is on, so this fills deletedAt and hides the row from later
  // queries rather than removing it.
  async remove(id: string): Promise<void> {
    try {
      const found = await this.caseModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Case '${id}' not found`);
      }
      await found.destroy();
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to remove case');
    }
  }

  // Multipart bodies arrive as strings, so coordinates are parsed and
  // range-checked here rather than trusted.
  private toCoordinate(raw: string | number | undefined, field: string, bound: number): number {
    const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
    if (!Number.isFinite(value) || Math.abs(value) > bound) {
      throw new BadRequestException(`'${field}' must be a number between -${bound} and ${bound}`);
    }
    return value;
  }

  // Guards the enum columns: without this a PATCH could park a case in a
  // status the routing and analytics modules do not know how to handle.
  private toEnum<T extends Record<string, string>>(raw: unknown, source: T, field: string): T[keyof T] {
    const allowed = Object.values(source);
    if (typeof raw !== 'string' || !allowed.includes(raw)) {
      throw new BadRequestException(`'${field}' must be one of: ${allowed.join(', ')}`);
    }
    return raw as T[keyof T];
  }

  private toBoolean(raw: unknown, field: string): boolean {
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (raw === 'true' || raw === 'false') {
      return raw === 'true';
    }
    throw new BadRequestException(`'${field}' must be true or false`);
  }

  private toTimestamp(raw?: string): Date {
    if (!raw) {
      return new Date();
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("'timeTaken' must be a valid ISO 8601 date");
    }
    return parsed;
  }

  // Rethrows anything already carrying a status (404/400 stay themselves) and
  // only wraps genuinely unexpected failures, so a missing row never becomes a 500.
  private asHttpError(error: any, context: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error?.name === 'SequelizeForeignKeyConstraintError') {
      return new BadRequestException("'reporterId' does not match a known user");
    }
    return new InternalServerErrorException(`${context}: ${error?.message ?? 'unknown error'}`);
  }
}
