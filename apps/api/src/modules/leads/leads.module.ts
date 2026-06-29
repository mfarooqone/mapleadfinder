import { Module } from '@nestjs/common';
import { DecisionMakerService } from './decision-maker.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, DecisionMakerService],
  exports: [LeadsService, DecisionMakerService],
})
export class LeadsModule {}
