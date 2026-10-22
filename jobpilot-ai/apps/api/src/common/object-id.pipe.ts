import { BadRequestException, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(v: string): string {
    if (!isValidObjectId(v)) throw new BadRequestException('Invalid id');
    return v;
  }
}
