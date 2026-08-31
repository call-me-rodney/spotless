import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Collector } from './models/collector.model';
import { User } from '../users/models/user.model';
import { Case } from '../case/models/case.model';
import { Status } from '../case/types/enum.type';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';

// A case in any of these states no longer needs anyone dispatched to it.
const SETTLED_STATUSES = [Status.closed, Status.rejected];

@Injectable()
export class CollectorsService {
  constructor(@InjectModel(Collector) private collectorModel: typeof Collector) {}

  // Staff are listed without their password hashes.
  private readonly detailIncludes = [
    { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'role'] },
    { model: Case, attributes: ['id', 'status', 'priority', 'latitude', 'longitude'] },
  ];

  async create(createCollectorDto: CreateCollectorDto): Promise<Collector> {
    try {
      const name = createCollectorDto.name.trim().replace(/\s+/g, ' ');
      const clash = await this.findByName(name);
      if (clash) {
        throw new BadRequestException(`Collector '${clash.name}' already exists`);
      }
      return await this.collectorModel.create({ ...createCollectorDto, name } as any);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to create collector');
    }
  }

  async findAll(): Promise<Collector[]> {
    try {
      return await this.collectorModel.findAll({ order: [['name', 'ASC']] });
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve collectors');
    }
  }

  async findOne(id: string): Promise<Collector> {
    try {
      const found = await this.collectorModel.findByPk(id, { include: this.detailIncludes });
      if (!found) {
        throw new NotFoundException(`Collector '${id}' not found`);
      }
      return found;
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve collector');
    }
  }

  async update(id: string, updateCollectorDto: UpdateCollectorDto): Promise<Collector> {
    try {
      const found = await this.collectorModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Collector '${id}' not found`);
      }

      const changes: Partial<Collector> = { ...(updateCollectorDto as Partial<Collector>) };

      if (updateCollectorDto.name !== undefined) {
        const name = updateCollectorDto.name.trim().replace(/\s+/g, ' ');
        const clash = await this.findByName(name);
        if (clash && clash.id !== id) {
          throw new BadRequestException(`Collector '${clash.name}' already exists`);
        }
        changes.name = name;
      }

      return await found.update(changes);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to update collector');
    }
  }

  // Blocked while the organisation still owns work: removing it would leave
  // live cases pointing at a collector no dashboard will surface again.
  async remove(id: string): Promise<void> {
    try {
      const found = await this.collectorModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Collector '${id}' not found`);
      }

      const activeCases = await found.$count('cases', {
        where: { status: { [Op.notIn]: SETTLED_STATUSES } },
      });
      if (activeCases > 0) {
        throw new BadRequestException(
          `Collector '${found.name}' still has ${activeCases} unresolved case(s) assigned and cannot be removed`,
        );
      }

      await found.destroy();
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to remove collector');
    }
  }

  private async findByName(name: string): Promise<Collector | null> {
    // iLike with no wildcards is a case-insensitive exact match on Postgres.
    return await this.collectorModel.findOne({ where: { name: { [Op.iLike]: name } } });
  }

  private asHttpError(error: any, context: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return new BadRequestException('That collector name is already registered');
    }
    return new InternalServerErrorException(`${context}: ${error?.message ?? 'unknown error'}`);
  }
}
