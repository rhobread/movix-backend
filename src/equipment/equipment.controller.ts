import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}
  @Post('recommendation')
  async getEquipmentRecommendations(
    @Body() body: {
      userId: number;
      musclePoints: Record<string, number>
    } 
  ){
    const {userId, musclePoints} = body
    return await this.equipmentService.getEquipmentRecommendations(userId, musclePoints);
  }

  @Get('recommendation/:user_id')
  async getEquipmentRecommendationsByUser(@Param('user_id') user_id:string){
    return await this.equipmentService.getTopEquipmentRecommendationsFromLatestWorkout(+user_id)
  }
}
