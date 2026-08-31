import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import { extname, join } from 'path';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import type { UploadedImage } from './types/int.type';

// Relative path stored in cases.imagePath; kept relative so the rows survive a
// move to another host or to object storage later.
const IMAGE_DIR = 'uploads/cases';
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const imageDestination = join(process.cwd(), IMAGE_DIR);
if (!existsSync(imageDestination)) {
  mkdirSync(imageDestination, { recursive: true });
}

const caseImageOptions = {
  storage: diskStorage({
    destination: imageDestination,
    // The client's filename reaches the filesystem, so it is discarded in
    // favour of a generated one; only the extension is carried over.
    filename: (_req, file, callback) =>
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(`Unsupported image type '${file.mimetype}'. Accepted: ${ACCEPTED_MIME_TYPES.join(', ')}`),
        false,
      );
    }
    callback(null, true);
  },
};

@Controller('case')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', caseImageOptions))
  async create(@UploadedFile() image: UploadedImage, @Body() createCaseDto: CreateCaseDto) {
    if (!image) {
      throw new BadRequestException("A case requires a photo, sent as the 'image' field of a multipart/form-data body");
    }

    try {
      return await this.caseService.create(createCaseDto, `${IMAGE_DIR}/${image.filename}`);
    } catch (error) {
      // multer writes to disk before this handler runs, so a rejected case
      // would otherwise leave its photo behind — unbounded growth on a
      // public endpoint.
      await rm(image.path, { force: true });
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.caseService.findAll();
  }

  // ids are UUIDs — the scaffold's `+id` coerced them to NaN.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.caseService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCaseDto: UpdateCaseDto) {
    return this.caseService.update(id, updateCaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caseService.remove(id);
  }
}
