import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkoutController],
  providers: [WorkoutService],
})
export class WorkoutModule { }
