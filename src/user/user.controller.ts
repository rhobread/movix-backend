import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 1. Create a new user (input: email, name, password)
  @Post('register')
  async createUser(
    @Body() body: { email: string; name: string; password: string },
  ) {
    const user = await this.userService.createUser(body);
    return {
      statusCode: 201,
      message: 'User created successfully',
      data: user,
    };
  }

  // 2. Update user's height and weight
  @Put('measurements/:id')
  async updateMeasurements(
    @Param('id') id: string,
    @Body() body: { height: number; weight: number },
  ) {
    const updatedUser = await this.userService.updateUserMeasurements(
      +id,
      body,
    );
    return {
      statusCode: 200,
      message: 'Measurements updated successfully',
      data: updatedUser,
    };
  }

  // 3. Add equipments to a user (input: array of equipment IDs)
  @Post('equipments/:id')
  async addEquipments(
    @Param('id') id: string,
    @Body() body: { equipmentIds: number[] },
  ) {
    const result = await this.userService.addUserEquipments(+id, body.equipmentIds);
    return {
      statusCode: 200,
      message: 'Equipments added successfully',
      data: result,
    };
  }

  // 4. Remove equipments from a user (input: array of equipment IDs)
  @Delete('equipments/:id')
  async removeEquipments(
    @Param('id') id: string,
    @Body() body: { equipmentIds: number[] },
  ) {
    const result = await this.userService.removeUserEquipments(+id, body.equipmentIds);
    return {
      statusCode: 200,
      message: 'Equipments removed successfully',
      data: result,
    };
  }

  // 5. Update user availabilities (input: days_available and minutes_available arrays)
  //    This endpoint replaces the previous availabilities.
  @Put('availabilities/:id')
  async updateAvailabilities(
    @Param('id') id: string,
    @Body() body: { days_available: number[]; minutes_available: number[] },
  ) {
    const result = await this.userService.updateUserAvailabilities(+id, body);
    return {
      statusCode: 200,
      message: 'Availabilities updated successfully',
      data: result,
    };
  }
}
