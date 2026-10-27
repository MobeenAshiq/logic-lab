import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PRESIGN_TTL_SECONDS, R2Service } from './r2.service';
import { createUploadSchema, newUploadKey } from './uploads';
import type { CreateUploadInput } from './uploads';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly r2: R2Service) {}

  /**
   * Step 1 of an upload: the browser gets a presigned URL, then PUTs the file
   * straight to R2 with the same Content-Type, and saves the returned `key`.
   */
  @Post()
  async create(
    @Body(new ZodValidationPipe(createUploadSchema)) body: CreateUploadInput,
  ) {
    const key = newUploadKey(body.purpose, body.contentType);
    return {
      key,
      uploadUrl: await this.r2.getUploadUrl(key, body.contentType, body.size),
      method: 'PUT',
      headers: { 'Content-Type': body.contentType },
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }
}
