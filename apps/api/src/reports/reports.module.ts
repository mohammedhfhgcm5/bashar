import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { VisionModule } from '../vision/vision.module'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
  imports: [StorageModule, VisionModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
