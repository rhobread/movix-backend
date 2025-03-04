import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';


@Injectable()
export class UserService {
  constructor(private readonly prisma: DatabaseService) {}

  // 1. Create a new user (input: email, name, password)
  //    Also, assign default level 1 for all 8 groups.
  async createUser(input: { email: string; name: string; password: string }): Promise<any> {
    const existingUser = await this.prisma.users.findFirst({
      where:{
        email:input.email
      }
    })
    if (existingUser || existingUser.email ){
      throw new BadRequestException({
        statusCode : 400,
        message: 'user with this Email already exists',
        data: []
      })
    }
    const user = await this.prisma.users.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.password,
        // Create default user_group_level records for groups 1 to 8
        level: {
          create: [
            { group_id: 1, level: 1 },
            { group_id: 2, level: 1 },
            { group_id: 3, level: 1 },
            { group_id: 4, level: 1 },
            { group_id: 5, level: 1 },
            { group_id: 6, level: 1 },
            { group_id: 7, level: 1 },
          ],
        },
      },
      include: {
        level: true,
      },
    });
    return user;
  }


  async updateUserMeasurements(userId: number, measurements: { height: number; weight: number }): Promise<any> {
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        height: measurements.height,
        weight: measurements.weight,
      },
    });
    return updatedUser;
  }

  // 2. Update user's height and weight
  async insertUserMeasurements(
    userId: number,
    measurements: { height: number; weight: number }
  ): Promise<any> {
    // Update user's height and weight.
    const updatedUser = await this.prisma.users.updateManyAndReturn({
      where: { id: userId },
      data: {
        height: measurements.height,
        weight: measurements.weight,
      },
    });
  
    // Calculate BMI: weight (kg) divided by height (m) squared.
    const bmi = measurements.weight / (measurements.height * measurements.height);
  
    // Determine the new level based on BMI.
    let newLevel: number;
    if (bmi >= 35 && bmi <= 40) newLevel = 1;
    else if (bmi >= 30 && bmi < 35) newLevel = 2;
    else if (bmi >= 25 && bmi < 30) newLevel = 3;
    else if (bmi < 18.5) newLevel = 3;
    else if (bmi >= 18.5 && bmi < 25) newLevel = 4;
    else newLevel = 1; // fallback if BMI doesn't match any category
  
    // Update (or create) the user's group levels for all 8 groups.
    // Ensure your user_group_level model has a composite unique constraint on (user_id, group_id).
    for (let groupId = 1; groupId <= 7; groupId++) {
      await this.prisma.user_group_level.upsert({
        where: { user_id_group_id: { user_id: userId, group_id: groupId } },
        update: { level: newLevel },
        create: { user_id: userId, group_id: groupId, level: newLevel },
      });
    }
  
    return updatedUser;
  }
  

  // 3. Add equipments to a user (input: array of equipment IDs)
  async addUserEquipments(userId: number, equipmentIds: number[]): Promise<any> {
    const data = equipmentIds.map(equipId => ({
      user_id: userId,
      equipment_id: equipId,
    }));
    const result = await this.prisma.user_equipment.createMany({ data });
    return result;
  }

  // 4. Remove equipments from a user (input: array of equipment IDs)
  async removeUserEquipments(userId: number, equipmentIds: number[]): Promise<any> {
    const result = await this.prisma.user_equipment.deleteMany({
      where: {
        user_id: userId,
        equipment_id: { in: equipmentIds },
      },
    });
    return result;
  }

  // 5. Update user availabilities (input: days_available and minutes_available arrays)
  //    This function replaces any previous availabilities.
  async updateUserAvailabilities(
    userId: number,
    input: { days_available: number[]; minutes_available: number[] },
  ): Promise<any> {
    const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    await this.prisma.user_availability.deleteMany({ where: { user_id: userId } });
    const data = input.days_available.map((dayNum, index) => ({
      user_id: userId,
      day: dayMapping[dayNum],
      minutes: input.minutes_available[index],
    }));
    const result = await this.prisma.user_availability.createMany({ data });
    return result;
  }

  // New: Update user's group levels.
  // Accepts an array of { group_id, level } and updates (or creates) the user_group_level records.
  async updateUserLevels(userId: number, levels: { group_id: number; level: number }[]): Promise<any> {
    const results = [];
    for (const levelInput of levels) {
      const updated = await this.prisma.user_group_level.upsert({
        where: {
          // Requires a composite unique key on (user_id, group_id)
          user_id_group_id: { user_id: userId, group_id: levelInput.group_id },
        },
        update: { level: levelInput.level },
        create: { user_id: userId, group_id: levelInput.group_id, level: levelInput.level },
      });
      results.push(updated);
    }
    return results;
  }

  async getUserEquipment(user_id:number){
    try {
      const equipments = await this.prisma.user_equipment.findMany({
        where: {
          user_id: user_id
        },
        include : {
          equipment: true
        }
      })
      if (!equipments || equipments.length < 1){
        throw new NotFoundException({
          statusCode:404,
          message : "either user don't have any equipments or user doesn't exist",
          data :[]
        })
      }
      return {
        statusCode:200,
        message : "get user's equipment success",
        data: equipments
      }
    } catch (error) {
      throw error
    }
  }

  async getUserAvailability(user_id:number){
    try {
      const result = await this.prisma.user_availability.findMany({
        where:{
          user_id:user_id
        },
        
      })
      if (!result || result.length < 1){
        throw new NotFoundException({
          statusCode:404,
          message : "either user is never available or user doesn't exist",
          data :[]
        })
      }
      return {
        statusCode:200,
        message : "get user's availability success",
        data: result
      }
    } catch (error) {
      throw error
    }
  }
}
