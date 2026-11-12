import { Module } from '@nestjs/common';
import { ItemStorageService } from './item-storage.service';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, ItemStorageService],
  exports: [ItemsService],
})
export class ItemsModule {}

