import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)
  postgis = false

  async onModuleInit() {
    await this.$connect()
    await this.enablePostgis()
  }

  private async enablePostgis() {
    try {
      await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis')
      await this.$executeRawUnsafe(
        'ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS location geography(Point,4326)',
      )
      await this.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION property_set_location() RETURNS trigger AS $$
        BEGIN
          NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)
      await this.$executeRawUnsafe('DROP TRIGGER IF EXISTS property_location_bi ON "Property"')
      await this.$executeRawUnsafe(`
        CREATE TRIGGER property_location_bi
        BEFORE INSERT OR UPDATE OF lat, lng ON "Property"
        FOR EACH ROW EXECUTE FUNCTION property_set_location()
      `)
      await this.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS property_location_gix ON "Property" USING GIST (location)',
      )
      await this.$executeRawUnsafe(`
        UPDATE "Property"
        SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        WHERE location IS NULL
      `)
      this.postgis = true
      this.logger.log('PostGIS جاهز لاستعلام الخريطة')
    } catch (error) {
      this.postgis = false
      const message = error instanceof Error ? error.message : 'unknown'
      this.logger.warn(`PostGIS غير متاح، استعلام الخريطة يستخدم حدود الإحداثيات: ${message}`)
    }
  }
}
