// src/exercise/exercise.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';

@Injectable()
export class ExerciseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createExercise(createExerciseDto: Record<any, any>): Promise<any> {
    const exercise = await this.databaseService.exercise.create({
      data: {
        name: createExerciseDto.name,
        exercise_cd: createExerciseDto.exercise_cd,
        intensity: createExerciseDto.intensity,
        duration: createExerciseDto.duration,
        types: createExerciseDto.type,
        max_rep: createExerciseDto.max_rep,
        image: createExerciseDto.image || null,
        description: createExerciseDto.description || null,
        group: createExerciseDto.group_id
          ? {
              create: [
                {
                  group: { connect: { id: createExerciseDto.group_id } },
                  difficulty: createExerciseDto.difficulty,
                },
              ],
            }
          : undefined,
        muscles:
          createExerciseDto.muscles && createExerciseDto.muscles.length > 0
            ? {
                create: createExerciseDto.muscles.map((m) => ({
                  muscle: { connect: { id: m.muscle_id } },
                  rating: m.rating,
                })),
              }
            : undefined,
        equipments:
          createExerciseDto.equipments && createExerciseDto.equipments.length > 0
            ? {
                create: createExerciseDto.equipments.map((equipId) => ({
                  equipment: { connect: { id: equipId } },
                })),
              }
            : undefined,
      },
    });
    return exercise;
  }

  async getGroups(): Promise<any> {
    const groups = await this.databaseService.group.findMany();
    return groups;
  }

  async getMuscles(): Promise<any> {
    return await this.databaseService.muscle.findMany();
  }

  async getEquipments(): Promise<any> {
    return await this.databaseService.equipment.findMany();
  }

  // New: Get all exercises grouped by exercise_cd
  async getAllGrouped(): Promise<any> {
    const exercises = await this.databaseService.exercise.findMany({
      include: {
        // Adjust relation names as needed
        group: true,
        muscles: true,
        equipments: true,
      },
    });

    const grouped = exercises.reduce((acc, exercise) => {
      if (!acc[exercise.exercise_cd]) {
        acc[exercise.exercise_cd] = [];
      }
      acc[exercise.exercise_cd].push(exercise);
      return acc;
    }, {});

    return Object.keys(grouped).map((key) => ({
      exercise_cd: key,
      exercises: grouped[key],
    }));
  }

  // New: Get one exercise by id (with its relations)
  async findOne(id: number): Promise<any> {
    const exercise = await this.databaseService.exercise.findUnique({
      where: { id },
      include: {
        group: true,
        muscles: {
          include: { muscle: true },
        },
        equipments: true,
      },
    });
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    return exercise;
  }

  async getExerciseDescription(id: number){
    const exercise = await this.databaseService.exercise.findUnique({
      where: {id}
    })

    return {
      statusCode: 200,
      message: "success",
      data: exercise
    }
  }

  // New: Update an exercise (only allowed fields)
  async updateExercise(id: number, updateExerciseDto: Record<any,any>): Promise<any> {
    // Ensure the exercise exists
    const exercise = await this.findOne(id);
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    
    const updatedExercise = await this.databaseService.exercise.update({
      where: { id },
      data: {
        name: updateExerciseDto.name ?? exercise.name,
        max_rep: updateExerciseDto.max_rep ?? exercise.max_rep,
        image: updateExerciseDto.image ?? exercise.image,
        intensity: updateExerciseDto.intensity ?? exercise.intensity,
        duration: updateExerciseDto.duration ?? exercise.duration,
        // Update the difficulty in the group relation.
        group:
          exercise.group && exercise.group.length > 0 && updateExerciseDto.difficulty !== undefined
            ? {
                update: {
                  where: { id: exercise.group[0].id },
                  data: { difficulty: updateExerciseDto.difficulty },
                },
              }
            : undefined,
        // Update muscle ratings for existing muscle hits..
        muscles: updateExerciseDto.muscles
          ? {
              updateMany: updateExerciseDto.muscles.map((m) => ({
                where: {
                  exercise_id: id,
                  muscle_id: m.muscle_id,
                },
                data: { rating: m.rating },
              })),
            }
          : undefined,
      },
    });

    return updatedExercise;
  }
}
