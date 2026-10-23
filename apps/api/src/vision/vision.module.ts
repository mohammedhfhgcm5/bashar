import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { VisionService } from './vision.service'

@Module({
  imports: [StorageModule],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
