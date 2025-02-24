import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';


@Injectable()
export class UserService {
  constructor(private readonly prisma: DatabaseService) {}

  // 1. Create a new user (input: email, name, password)
  async createUser(input: { email: string; name: string; password: string }): Promise<any> {
    const user = await this.prisma.users.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.password,
      },
    });
    return user;
  }

  // 2. Update user's height and weight
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

  // 3. Add equipments to a user (input: array of equipment IDs)
  async addUserEquipments(userId: number, equipmentIds: number[]): Promise<any> {
    // Prepare data for bulk insertion.
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
  //    This function deletes previous availabilities and inserts new ones.
  async updateUserAvailabilities(
    userId: number,
    input: { days_available: number[]; minutes_available: number[] },
  ): Promise<any> {
    // Mapping day numbers to day names (0 = Sunday, 1 = Monday, etc.)
    const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Delete existing availabilities for the user.
    await this.prisma.user_availability.deleteMany({
      where: { user_id: userId },
    });

    // Prepare new availability records.
    const data = input.days_available.map((dayNum, index) => ({
      user_id: userId,
      day: dayMapping[dayNum],
      minutes: input.minutes_available[index],
    }));

    const result = await this.prisma.user_availability.createMany({ data });
    return result;
  }
}
