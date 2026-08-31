import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Waste } from './models/wasteType.model';
import { WasteInstance } from './models/wasteInstance.model';
import { Case } from '../case/models/case.model';
import { CreateWasteDto } from './dto/create-waste.dto';
import { UpdateWasteDto } from './dto/update-waste.dto';
import { CreateWasteInstanceDto } from './dto/create-waste-instance.dto';
import { UpdateWasteInstanceDto } from './dto/update-waste-instance.dto';

@Injectable()
export class WasteService {
  constructor(
    @InjectModel(Waste) private wasteModel: typeof Waste,
    @InjectModel(WasteInstance) private wasteInstanceModel: typeof WasteInstance,
  ) {}

  private readonly instanceIncludes = [
    { model: Waste },
    { model: Case, attributes: ['id', 'status', 'latitude', 'longitude', 'imagePath'] },
  ];

  // ---------------------------------------------------------------- types

  async createType(createWasteDto: CreateWasteDto): Promise<Waste> {
    try {
      const name = this.normaliseName(createWasteDto.name);
      const existing = await this.findTypeByName(name);
      if (existing) {
        throw new BadRequestException(`Waste type '${existing.name}' already exists`);
      }
      return await this.wasteModel.create({ ...createWasteDto, name } as any);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to create waste type');
    }
  }

  async findAllTypes(): Promise<Waste[]> {
    try {
      return await this.wasteModel.findAll({ order: [['name', 'ASC']] });
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve waste types');
    }
  }

  async findOneType(id: string): Promise<Waste> {
    try {
      const found = await this.wasteModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Waste type '${id}' not found`);
      }
      return found;
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve waste type');
    }
  }

  async updateType(id: string, updateWasteDto: UpdateWasteDto): Promise<Waste> {
    try {
      const found = await this.findOneType(id);
      const changes: Partial<Waste> = { ...(updateWasteDto as Partial<Waste>) };

      if (updateWasteDto.name !== undefined) {
        const name = this.normaliseName(updateWasteDto.name);
        const clash = await this.findTypeByName(name);
        if (clash && clash.id !== id) {
          throw new BadRequestException(`Waste type '${clash.name}' already exists`);
        }
        changes.name = name;
      }

      return await found.update(changes);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to update waste type');
    }
  }

  async removeType(id: string): Promise<void> {
    try {
      const found = await this.findOneType(id);
      const inUse = await this.wasteInstanceModel.count({ where: { wasteTypeId: id } });
      if (inUse > 0) {
        throw new BadRequestException(
          `Waste type '${found.name}' still has ${inUse} recorded instance(s) and cannot be removed`,
        );
      }
      await found.destroy();
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to remove waste type');
    }
  }

  // ------------------------------------------------------------ instances

  async createInstance(createDto: CreateWasteInstanceDto): Promise<WasteInstance> {
    try {
      // One transaction: if the instance insert fails (an unknown caseId, say)
      // a waste type auto-created from the CNN label rolls back with it,
      // instead of leaving a junk entry in the catalog.
      const created = await this.wasteInstanceModel.sequelize!.transaction(async (transaction) => {
        const wasteType = await this.resolveWasteType(createDto, transaction);

        return await this.wasteInstanceModel.create(
          {
            wasteTypeId: wasteType.id,
            caseId: createDto.caseId,
            quantity: createDto.quantity ?? 1,
            location: createDto.location,
            date: this.toTimestamp(createDto.date),
          } as any,
          { transaction },
        );
      });

      return await this.findOneInstance(created.id);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to record waste instance');
    }
  }

  async findAllInstances(filters: { caseId?: string; wasteTypeId?: string } = {}): Promise<WasteInstance[]> {
    try {
      const where: Record<string, string> = {};
      if (filters.caseId) where.caseId = filters.caseId;
      if (filters.wasteTypeId) where.wasteTypeId = filters.wasteTypeId;

      return await this.wasteInstanceModel.findAll({
        where,
        include: this.instanceIncludes,
        order: [['date', 'DESC']],
      });
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve waste instances');
    }
  }

  async findOneInstance(id: string): Promise<WasteInstance> {
    try {
      const found = await this.wasteInstanceModel.findByPk(id, { include: this.instanceIncludes });
      if (!found) {
        throw new NotFoundException(`Waste instance '${id}' not found`);
      }
      return found;
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve waste instance');
    }
  }

  async updateInstance(id: string, updateDto: UpdateWasteInstanceDto): Promise<WasteInstance> {
    try {
      const found = await this.wasteInstanceModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Waste instance '${id}' not found`);
      }

      // Same transaction guarantee as createInstance: a re-labelled instance
      // must not leave a new waste type behind if the update itself fails.
      await this.wasteInstanceModel.sequelize!.transaction(async (transaction) => {
        const changes: Partial<WasteInstance> = {};
        if (updateDto.quantity !== undefined) changes.quantity = updateDto.quantity;
        if (updateDto.location !== undefined) changes.location = updateDto.location;
        if (updateDto.caseId !== undefined) changes.caseId = updateDto.caseId;
        if (updateDto.date !== undefined) changes.date = this.toTimestamp(updateDto.date);
        if (updateDto.wasteTypeId !== undefined || updateDto.wasteTypeName !== undefined) {
          changes.wasteTypeId = (await this.resolveWasteType(updateDto, transaction)).id;
        }

        await found.update(changes, { transaction });
      });

      return await this.findOneInstance(id);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to update waste instance');
    }
  }

  async removeInstance(id: string): Promise<void> {
    try {
      const found = await this.wasteInstanceModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Waste instance '${id}' not found`);
      }
      await found.destroy();
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to remove waste instance');
    }
  }

  // ------------------------------------------------------------- helpers

  // The CNN reports a label, not a UUID. An id wins when supplied; otherwise
  // the label is matched case-insensitively and registered if genuinely new,
  // so 'Plastic Bottle' and 'plastic bottle' never become two catalog entries.
  private async resolveWasteType(
    dto: { wasteTypeId?: string; wasteTypeName?: string },
    transaction?: Transaction,
  ): Promise<Waste> {
    if (dto.wasteTypeId) {
      return await this.findOneType(dto.wasteTypeId);
    }

    if (!dto.wasteTypeName?.trim()) {
      throw new BadRequestException("Provide either 'wasteTypeId' or 'wasteTypeName'");
    }

    const name = this.normaliseName(dto.wasteTypeName);
    const existing = await this.findTypeByName(name, transaction);
    return existing ?? (await this.wasteModel.create({ name } as any, { transaction }));
  }

  private async findTypeByName(name: string, transaction?: Transaction): Promise<Waste | null> {
    // iLike with no wildcards is a case-insensitive exact match on Postgres.
    return await this.wasteModel.findOne({ where: { name: { [Op.iLike]: name } }, transaction });
  }

  private normaliseName(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
  }

  private toTimestamp(raw?: string): Date {
    if (!raw) {
      return new Date();
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("'date' must be a valid ISO 8601 date");
    }
    return parsed;
  }

  private asHttpError(error: any, context: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error?.name === 'SequelizeForeignKeyConstraintError') {
      return new BadRequestException("'caseId' does not match a known case");
    }
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return new BadRequestException('That waste type name is already registered');
    }
    return new InternalServerErrorException(`${context}: ${error?.message ?? 'unknown error'}`);
  }
}
