import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EquipmentService {
    constructor(private readonly databaseService: DatabaseService) {}

    async getEquipmentRecommendations(
        userId: number,
        musclePoints: Record<string, number>
      ): Promise<{ id: number; name: string; totalScore: number; muscleScores: Record<string, number> }[]> {
    const muscleNames = Object.keys(musclePoints);
    const totalPoints = muscleNames.reduce((sum, m) => sum + musclePoints[m], 0);
    const average = totalPoints / muscleNames.length;
    const deficits: Record<string, number> = {};
    muscleNames.forEach((m) => {
      const deficit = average - musclePoints[m];
      // Normalize muscle name to lowercase.
      deficits[m.toLowerCase()] = deficit > 0 ? deficit : 0;
    });

    // 2. Get user's current equipment IDs.
    const userEquipments = await this.databaseService.user_equipment.findMany({
      where: { user_id: userId },
      select: { equipment_id: true },
    });
    const userEquipmentIds = userEquipments.map((ue) => ue.equipment_id);

    // 3. Get all equipments that the user does not have.
    const missingEquipments = await this.databaseService.equipment.findMany({
      where: {
        id: { notIn: userEquipmentIds },
      },
      select: { id: true, name: true },
    });

    // 4. For each missing equipment, compute a detailed recommendation score.
    const recommendations: { id: number; name: string; totalScore: number; muscleScores: Record<string, number> }[] = [];
    for (const equip of missingEquipments) {
      let totalScore = 0;
      const muscleScores: Record<string, number> = {};
      // Get exercises that require this equipment.
      const equipExercises = await this.databaseService.exercise_equipment.findMany({
        where: { equipment_id: equip.id },
        include: {
          exercise: {
            include: {
              muscles: { include: { muscle: true } },
            },
          },
        },
      });

      // Sum contributions from each exercise.
      for (const ee of equipExercises) {
        const exercise = ee.exercise;
        for (const em of exercise.muscles) {
          const muscleName = em.muscle.name.toLowerCase();
          const rating = em.rating;
          const contribution = rating * (deficits[muscleName] || 0);
          muscleScores[muscleName] = (muscleScores[muscleName] || 0) + contribution;
          totalScore += contribution;
        }
      }
      recommendations.push({ id: equip.id, name: equip.name, totalScore, muscleScores });
    }

    // 5. Sort recommendations descending by totalScore and return top 3.
    recommendations.sort((a, b) => b.totalScore - a.totalScore);
    return recommendations.slice(0, 3);
      
    }

    async getTopEquipmentRecommendationsFromLatestWorkout(
        userId: number
      ): Promise<{ id: number; name: string; totalScore: number; muscleScores: Record<string, number> }[]> {
        // Get the latest workoutPerWeek record for the user.
        const latestWPW = await this.databaseService.workoutperweek.findFirst({
          where: { user_id: userId },
          orderBy: { id: 'desc' },
          include: {
            workouts: {
              include: {
                workout: {
                  include: {
                    exercises: {
                      include: {
                        exercise: {
                          include: {
                            muscles: { include: { muscle: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!latestWPW) {
          throw new Error('No workout plan found for the user.');
        }
    
        // Compute overall musclePoints from the workouts in the latest workoutPerWeek.
        const musclePoints: Record<string, number> = {};
        // Initialize for all muscles from the database.
        const muscles = await this.databaseService.muscle.findMany();
        muscles.forEach((m) => {
          musclePoints[m.name.toLowerCase()] = 0;
        });
    
        // Aggregate muscle points from each workout in the workoutPerWeek.
        for (const wpw of latestWPW.workouts) {
          const workout = wpw.workout;
          for (const we of workout.exercises) {
            const exercise = we.exercise;
            for (const em of exercise.muscles) {
              const muscleName = em.muscle.name.toLowerCase();
              musclePoints[muscleName] += em.rating * we.set; // using number of sets as multiplier
            }
          }
        }
    
        // Now return recommendations based on these musclePoints.
        return await this.getEquipmentRecommendations(userId, musclePoints);
      }
}
