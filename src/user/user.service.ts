import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
    constructor(private readonly databaseService: DatabaseService) { }

    async getAllUser() {
        const users = await this.databaseService.user.findMany()
        return {
            statusCode: 200,
            message: 'All user get',
            data: users,
        };
    }

    async createUser(body: { name: string, height: number; weight: number; equipments: number[]; days_available: number[]; minutes_available: number[] }) {
        const { name, height, weight, equipments, days_available, minutes_available } = body;

        // Create user
        const user = await this.databaseService.user.create({
            data: {
                name,
                height,
                weight,
            },
        });

        // Insert user equipment
        await this.databaseService.user_equipment.createMany({
            data: equipments.map(equipment_id => ({ user_id: user.id, equipment_id })),
        });

        // Insert user availability
        await this.databaseService.user_availability.createMany({
            data: days_available.map((day, index) => ({
                user_id: user.id,
                day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
                minutes: minutes_available[index],
            })),
        });

        return {
            statusCode: 201,
            message: 'User created successfully',
            data: user,
        };
    }


    async generateWorkoutPlan(userId: number) {
        // Fetch user details
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
            include: {
                availabilities: true,
                equipments: { include: { equipment: true } },
            },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const availableDays = user.availabilities.map(avail => ({
            day: avail.day,
            minutes: avail.minutes,
        }));

        const userEquipmentIds = user.equipments.map(eq => eq.equipment_id);

        // Fetch available exercises based on equipment
        const exercises = await this.databaseService.exercise.findMany({
            include: {
                equipments: { select: { equipment_id: true } },
                muscles: {
                    include: { muscle: true }, // Ensure muscle data is included
                },
            },
        });

        // Filter exercises by user's equipment
        const filteredExercises = exercises.filter(exercise => {
            return exercise.equipments.every(eq => userEquipmentIds.includes(eq.equipment_id));
        });

        // Sort exercises by intensity and duration for efficient scheduling
        const intensityScore = { low: 1, medium: 2, high: 4, 'very high': 6 };
        const sortedExercises = filteredExercises.sort((a, b) => {
            return (a.duration + intensityScore[a.intensity]) - (b.duration + intensityScore[b.intensity]);
        });

        // Group exercises by muscle
        const muscleMap = new Map<string, any[]>();
        sortedExercises.forEach(exercise => {
            exercise.muscles.forEach(muscleRelation => {
                const muscleName = muscleRelation.muscle.name; // Now correctly includes muscle data
                if (!muscleMap.has(muscleName)) muscleMap.set(muscleName, []);
                muscleMap.get(muscleName)?.push({ ...exercise, rating: muscleRelation.rating });
            });
        });

        // Generate the workout plan
        const workoutPlan = [];

        availableDays.forEach(({ day, minutes }) => {
            let remainingTime = minutes;
            const workout = { day, exercises: [] };

            // Distribute exercises evenly among muscles
            const muscleOrder = Array.from(muscleMap.keys()).sort(() => Math.random() - 0.5);

            while (remainingTime > 0 && muscleOrder.length) {
                const muscle = muscleOrder.shift();
                const availableExercises = muscleMap.get(muscle);

                if (!availableExercises || !availableExercises.length) continue;

                // Pick the best exercise based on rating
                const bestExercise = availableExercises.sort((a, b) => b.rating - a.rating)[0];

                const exerciseTime = bestExercise.duration + intensityScore[bestExercise.intensity];

                if (exerciseTime <= remainingTime) {
                    workout.exercises.push({
                        exerciseId: bestExercise.id,
                        sets: Math.min(3, Math.floor(remainingTime / exerciseTime)), // Max 3 sets unless it's the only one
                    });
                    remainingTime -= exerciseTime * Math.min(3, Math.floor(remainingTime / exerciseTime));
                }
            }

            workoutPlan.push(workout);
        });

        // Store the generated workouts
        for (const workout of workoutPlan) {
            const createdWorkout = await this.databaseService.workout.create({
                data: {
                    exercises: {
                        create: workout.exercises.map(ex => ({
                            exercise: { connect: { id: ex.exerciseId } },
                        })),
                    },
                },
            });

            await this.databaseService.workoutperweek.create({
                data: {
                    user: { connect: { id: userId } },
                    workouts: { create: { workout: { connect: { id: createdWorkout.id } } } },
                },
            });
        }

        return {
            statusCode: 201,
            message: 'Workout plan generated successfully',
            data: workoutPlan,
        };
    }

    async getWorkoutPlan(userId: number) {
        // Fetch user's weekly workout schedule
        const userWorkouts = await this.databaseService.workoutperweek.findMany({
            where: { user_id: userId },
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

        if (!userWorkouts.length) {
            return {
                statusCode: 404,
                message: 'No workout plan found for this user',
                data: [],
            };
        }

        // Fetch user availability days in parallel
        const userAvailabilities = await this.databaseService.user_availability.findMany({
            where: { user_id: userId },
        });

        const availabilityMap = new Map(
            userAvailabilities.map(a => [a.id, a.day]) // Map { availabilityId -> dayName }
        );

        // Process each workout day asynchronously
        const formattedPlan = await Promise.all(
            userWorkouts.map(async workoutDay => {
                const day = availabilityMap.get(workoutDay.id) || 'Unknown';

                const exercises = workoutDay.workouts.flatMap(wp =>
                    wp.workout.exercises.map(ex => ({
                        exercise: ex.exercise.name,
                        total_time: ex.exercise.duration + this.getRestTime(ex.exercise.intensity),
                        targetted_muscle: ex.exercise.muscles.map(m => m.muscle.name),
                    }))
                );

                return { [day]: exercises };
            })
        );

        return {
            statusCode: 201,
            message: 'Success',
            data: formattedPlan,
        };
    }

    // Helper function to calculate rest time based on intensity
    private getRestTime(intensity: string): number {
        const restTimes = { low: 1, medium: 2, high: 4, 'very high': 6 };
        return restTimes[intensity] || 0;
    }


}
