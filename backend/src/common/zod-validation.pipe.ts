import { HttpStatus, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from './app-exception';

/** Usage: `@Body(new ZodValidationPipe(schema)) body: z.infer<typeof schema>` */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
