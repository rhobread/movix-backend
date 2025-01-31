import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('all')
  async getAllUser() {
    return await this.userService.getAllUser()
  }

  @Get('workout-plan/:user_id')
  async getWorkoutPlan(@Param('user_id') user_id: string) {
    return await this.userService.getWorkoutPlan(+user_id)
  }

  @Post('create')
  async createUser(@Body() body: { name: string, height: number; weight: number; equipments: number[]; days_available: number[]; minutes_available: number[] }) {
    return await this.userService.createUser(body);
  }

  @Post('generate-plan/:user_id')
  async generatePlan(@Param('user_id') user_id: string) {
    return await this.userService.generateWorkoutPlan(+user_id)
  }
}
