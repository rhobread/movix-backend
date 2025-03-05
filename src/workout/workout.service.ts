import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment';


interface DayExercise {
    exercise: any;
    sets: number;
}
interface ExtendedExercise {
    // Represents our filtered/selected exercise variant for a given exercise_cd.
    id: number;
    exercise_cd: string;
    name: string;
    intensity: string;
    duration: number;
    types: string;
    muscles: any[];
    equipments: any[];
    group?: { id: number; difficulty?: number; group_id: number }[]; // excercise_group entries
  }
  
@Injectable()
export class WorkoutService {
    constructor(private readonly databaseService: DatabaseService) { }

    async getAllUser() {
      try {
        const users = await this.databaseService.users.findMany({
            include:{
                level:{
                    select:{
                        level:true,
                        group:{
                            select:{
                                name:true
                            }
                        },
                    }
                }
            }
        })
        if (!users || users.length < 1){
          throw new NotFoundException({
            statusCode:404,
            message: 'No users found',
            data:[]
          })
        }
        return {
            statusCode: 200,
            message: 'All user get',
            data: users,
        };
      } catch (error) {
        throw error
      }
    }

    // async createUser(body: { name: string, height: number; weight: number; equipments: number[]; days_available: number[]; minutes_available: number[] }) {
    //     const { name, height, weight, equipments, days_available, minutes_available } = body;

    //     // Create user
    //     const user = await this.databaseService.users.create({
    //         data: {
    //             name,
    //             height,
    //             weight,
    //         },
    //     });

    //     // Insert user equipment
    //     await this.databaseService.user_equipment.createMany({
    //         data: equipments.map(equipment_id => ({ user_id: user.id, equipment_id })),
    //     });

    //     // Insert user availability
    //     await this.databaseService.user_availability.createMany({
    //         data: days_available.map((day, index) => ({
    //             user_id: user.id,
    //             day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
    //             minutes: minutes_available[index],
    //         })),
    //     });

    //     return {
    //         statusCode: 201,
    //         message: 'User created successfully',
    //         data: user,
    //     };
    // }


    async getAllEquipments(){
        try {
            const result = await this.databaseService.equipment.findMany()
            if (!result || result.length < 1){
              throw new NotFoundException({
                statusCode: 404,
                message: 'No equipments in database',
                data : [],
              })
            }
            return {
                statusCode: 200,
                message: 'All equipment get',
                data: result,
            }
        } catch (error) {
            throw error
        }
    }


    async makeWorkoutPlanForUser(userId: number) {
      // 1. Fetch the user with their equipments, availabilities, and group levels.
      const user = await this.databaseService.users.findUnique({
        where: { id: userId },
        include: {
          equipments: true,
          availabilities: true,
          level: true, // user_group_level
        },
      });
      if (!user)
        throw new NotFoundException({
          statusCode: 404,
          message: "User with this id doesn't exist",
          data: [],
        });
    
      // Create a mapping for user's group level.
      const userGroupLevels: Record<number, number> = {};
      if (user.level) {
        user.level.forEach((ugl) => {
          userGroupLevels[ugl.group_id] = ugl.level;
        });
      }
      console.log(userGroupLevels)
    
      // Convert user's equipments into an array of equipment IDs.
      const userEquipmentIds = user.equipments.map((ue) => ue.equipment_id);
    
      // Mapping from day name to day number.
      const dayNameToNumber: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
    
      // Convert availabilities into arrays of day numbers and minutes.
      const daysAvailable: number[] = [];
      const minutesAvailable: number[] = [];
      user.availabilities.forEach((av) => {
        const dayNum = dayNameToNumber[av.day.toLowerCase()];
        if (dayNum !== undefined) {
          daysAvailable.push(dayNum);
          minutesAvailable.push(av.minutes);
        }
      });
    
      // *** NEW: Delete all workouts for the user from tomorrow until 7 days later ***
      const tomorrow = moment().add(1, 'days').startOf('day').toDate();
      const sevenDaysLater = moment().add(7, 'days').endOf('day').toDate();
      const workoutsToDelete = await this.databaseService.workout.findMany({
        where: {
          date: { gte: tomorrow, lte: sevenDaysLater },
          perWeek: { some: { workoutperweek: { user_id: userId } } },
        },
        select: { id: true },
      });
      const workoutIds = workoutsToDelete.map((w) => w.id);
      if (workoutIds.length > 0) {
        await this.databaseService.workout_exercise.deleteMany({
          where: { workout_id: { in: workoutIds } },
        });
        await this.databaseService.workout_per_week_workout.deleteMany({
          where: { workout_id: { in: workoutIds } },
        });
        await this.databaseService.workout.deleteMany({
          where: { id: { in: workoutIds } },
        });
      }
    
      // 2. Fetch all exercises with related muscles, equipments, and group data.
      const exercises = await this.databaseService.exercise.findMany({
        include: {
          muscles: { include: { muscle: true } },
          equipments: true,
          group: true, // returns array of excercise_group entries
        },
      });
    
      // 3. Filter exercises based on user's available equipments.
      const filteredExercises = exercises.filter((ex) => {
        if (ex.equipments.length === 0) return true;
        return ex.equipments.every(
          (eq) =>
            eq.equipment_id === null || userEquipmentIds.includes(eq.equipment_id)
        );
      });
    
      // 4. Group exercises by exercise_cd.
      const exercisesByCd: Record<string, ExtendedExercise[]> = {};
      filteredExercises.forEach((ex: ExtendedExercise) => {
        if (!exercisesByCd[ex.exercise_cd]) {
          exercisesByCd[ex.exercise_cd] = [];
        }
        exercisesByCd[ex.exercise_cd].push(ex);
      });
    
      // 5. Build a flattened list of valid variants.
      let allValidVariants: ExtendedExercise[] = [];
      for (const cd in exercisesByCd) {
        const variants = exercisesByCd[cd];
        // If exercise has group info, filter by valid ones (difficulty <= user's level)
        let validVariants = variants.filter((v) => {
          if (v.group && v.group.length > 0) {
            const groupId = v.group[0].group_id;
            const userLevel = userGroupLevels[groupId];
            return v.group[0].difficulty !== null && v.group[0].difficulty <= userLevel;
          }
          return true; // if no group info, it's valid.
        });
        // if (validVariants.length === 0) {
        //   // If none pass the filter, fallback to all variants.
        //   validVariants = variants;
        // }
        // Sort variants descending by difficulty (if group info exists).
        validVariants.sort((a, b) => {
          const diffA = a.group && a.group.length > 0 ? a.group[0].difficulty || 0 : 0;
          const diffB = b.group && b.group.length > 0 ? b.group[0].difficulty || 0 : 0;
          return diffB - diffA;
        });
        // Push all valid variants for this exercise_cd.
        allValidVariants.push(...validVariants);
      }
      // Sort the complete list by descending difficulty.
      allValidVariants.sort((a, b) => {
        const diffA = a.group && a.group.length > 0 ? a.group[0].difficulty || 0 : 0;
        const diffB = b.group && b.group.length > 0 ? b.group[0].difficulty || 0 : 0;
        return diffB - diffA;
      });
    
      // 6. Helper: Calculate rest time based on intensity.
      const getRestTime = (intensity: string): number => {
        switch (intensity.toLowerCase()) {
          case 'low': return 1;
          case 'medium': return 2;
          case 'high': return 4;
          case 'very high':
          case 'very_high': return 6;
          default: return 0;
        }
      };
    
      // 7. Annotate each valid variant with meta-data: points and totalTime per set.
      const exercisesWithMeta = allValidVariants.map((ex) => {
        const points = ex.muscles.reduce((sum, em) => sum + em.rating, 0);
        const totalTime = (ex.duration || 0) + getRestTime(ex.intensity);
        return { ...ex, points, totalTime };
      });
    
      // 8. Build weekly workout plans using overall (global) muscle balance.
      const workoutsPlan = [];
      const marginMultiplier = 1.2; // up to 20% over nominal minutes
      const globalMusclePoints: Record<string, number> = {};
      const allMuscleNames = (await this.databaseService.muscle.findMany()).map((m) => m.name);
      allMuscleNames.forEach((name) => (globalMusclePoints[name] = 0));
      const overallExerciseSetCount: Record<number, number> = {};
    
      for (let i = 0; i < daysAvailable.length; i++) {
        const nominalTime = minutesAvailable[i];
        const timeLimit = nominalTime * marginMultiplier;
        let usedTime = 0;
        const dayExercises: { exercise: any; sets: number }[] = [];
        const computeImbalance = (mp: Record<string, number>): number => {
          const values = Object.values(mp);
          const avg = values.reduce((a, b) => a + b, 0) / values.length || 0;
          if (avg === 0) return Infinity;
          const max = Math.max(...values);
          const min = Math.min(...values);
          return (max - min) / avg;
        };
    
        while (usedTime < timeLimit) {
          const candidates = exercisesWithMeta.filter(
            (ex) => ex.totalTime <= timeLimit - usedTime
          );
          if (candidates.length === 0) break;
          let bestCandidate = null;
          let bestImbalance = Number.POSITIVE_INFINITY;
          let bestSets = 0;
          let foundCandidate = false;
          // First pass: consider candidates that haven't hit the default 3-set cap.
          for (const candidate of candidates) {
            const currentSets = overallExerciseSetCount[candidate.id] || 0;
            const maxAdditional = 4 - currentSets;
            if (maxAdditional < 1) continue;
            const maxByTime = Math.floor((timeLimit - usedTime) / candidate.totalTime);
            const possibleSets = Math.min(maxAdditional, maxByTime);
            if (possibleSets < 1) continue;
            foundCandidate = true;
            const simulatedGlobal = { ...globalMusclePoints };
            candidate.muscles.forEach((em) => {
              const muscleName = em.muscle.name;
              simulatedGlobal[muscleName] += em.rating * possibleSets;
            });
            const imbalance = computeImbalance(simulatedGlobal);
            if (imbalance < bestImbalance) {
              bestImbalance = imbalance;
              bestCandidate = candidate;
              bestSets = possibleSets;
            }
          }
          // Second pass: if no candidate qualifies due to 3-set cap, relax and allow extra set.
          if (!foundCandidate) {
            for (const candidate of candidates) {
              const maxByTime = Math.floor((timeLimit - usedTime) / candidate.totalTime);
              if (maxByTime < 1) continue;
              const simulatedGlobal = { ...globalMusclePoints };
              candidate.muscles.forEach((em) => {
                const muscleName = em.muscle.name;
                simulatedGlobal[muscleName] += em.rating; // adding one set
              });
              const imbalance = computeImbalance(simulatedGlobal);
              if (imbalance < bestImbalance) {
                bestImbalance = imbalance;
                bestCandidate = candidate;
                bestSets = 1;
              }
            }
          }
          if (!bestCandidate) break;
          bestCandidate.muscles.forEach((em) => {
            const muscleName = em.muscle.name;
            globalMusclePoints[muscleName] += em.rating * bestSets;
          });
          const prevSets = overallExerciseSetCount[bestCandidate.id] || 0;
          overallExerciseSetCount[bestCandidate.id] = prevSets + bestSets;
          const existing = dayExercises.find((e) => e.exercise.id === bestCandidate.id);
          if (existing) {
            existing.sets += bestSets;
          } else {
            dayExercises.push({ exercise: bestCandidate, sets: bestSets });
          }
          usedTime += bestCandidate.totalTime * bestSets;
          if (usedTime >= nominalTime * 0.95) break;
        }
        let workoutDate = moment().day(daysAvailable[i]);
        if (workoutDate.isBefore(moment(), 'day')) workoutDate.add(7, 'days');
        workoutsPlan.push({
          date: workoutDate.toDate(),
          exercises: dayExercises,
          totalUsedTime: usedTime,
        });
      }
    
      // 9. Dummy load calculation: for weight, constant; for bodyweight, use the selected exercise's level.
      const calculateLoad = (exercise: any) => {
        if (exercise.types === 'weight') return { weight: 10 };
        if (exercise.types === 'bodyweight') return { level: exercise.group && exercise.group.length > 0 ? exercise.group[0].difficulty : null };
        return {};
      };
    
      // 10. Save the weekly workout plan into the database.
      const savedWorkouts = [];
      for (const plan of workoutsPlan) {
        const workoutRecord = await this.databaseService.workout.create({
          data: { date: plan.date },
        });
        for (const item of plan.exercises) {
          const load = calculateLoad(item.exercise);
          await this.databaseService.workout_exercise.create({
            data: {
              workout_id: workoutRecord.id,
              exercise_id: item.exercise.id,
              set: item.sets,
              reps: 10,
              weight: load.weight || null,
            },
          });
        }
        savedWorkouts.push(workoutRecord);
      }
    
      // 11. Create a workoutperweek record and associate all saved workouts.
      const workoutPerWeekRecord = await this.databaseService.workoutperweek.create({
        data: { user_id: userId },
      });
      for (const workout of savedWorkouts) {
        await this.databaseService.workout_per_week_workout.create({
          data: {
            workout_id: workout.id,
            workoutperweek_id: workoutPerWeekRecord.id,
          },
        });
      }
      return workoutPerWeekRecord;
    }
    

    async generateWorkoutPlan(userId: number): Promise<any> {
      // 1. Fetch the user with their equipments, availabilities, and group levels.
      const user = await this.databaseService.users.findUnique({
        where: { id: userId },
        include: {
          equipments: true,
          availabilities: true,
          level: true, // user_group_level
        },
      });
      if (!user)
        throw new NotFoundException({
          statusCode: 404,
          message: "User with this id doesn't exist",
          data: [],
        });
    
      // Create a mapping for user's group level.
      const userGroupLevels: Record<number, number> = {};
      if (user.level) {
        user.level.forEach((ugl) => {
          userGroupLevels[ugl.group_id] = ugl.level;
        });
      }
      console.log("User group levels:", userGroupLevels);
    
      // Convert user's equipments into an array of equipment IDs.
      const userEquipmentIds = user.equipments.map((ue) => ue.equipment_id);
    
      // Mapping from day name to day number.
      const dayNameToNumber: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
    
      // Convert availabilities into arrays of day numbers and minutes.
      const daysAvailable: number[] = [];
      const minutesAvailable: number[] = [];
      user.availabilities.forEach((av) => {
        const dayNum = dayNameToNumber[av.day.toLowerCase()];
        if (dayNum !== undefined) {
          daysAvailable.push(dayNum);
          minutesAvailable.push(av.minutes);
        }
      });
    
      // *** Delete all workouts for the user from tomorrow until 7 days later ***
      const tomorrow = moment().add(1, 'days').startOf('day').toDate();
      const sevenDaysLater = moment().add(7, 'days').endOf('day').toDate();
      const workoutsToDelete = await this.databaseService.workout.findMany({
        where: {
          date: { gte: tomorrow, lte: sevenDaysLater },
          perWeek: { some: { workoutperweek: { user_id: userId } } },
        },
        select: { id: true },
      });
      const workoutIds = workoutsToDelete.map((w) => w.id);
      if (workoutIds.length > 0) {
        await this.databaseService.workout_exercise.deleteMany({
          where: { workout_id: { in: workoutIds } },
        });
        await this.databaseService.workout_per_week_workout.deleteMany({
          where: { workout_id: { in: workoutIds } },
        });
        await this.databaseService.workout.deleteMany({
          where: { id: { in: workoutIds } },
        });
      }
    
      // 2. Fetch all exercises with related muscles, equipments, and group data.
      const exercises = await this.databaseService.exercise.findMany({
        include: {
          muscles: { include: { muscle: true } },
          equipments: true,
          group: true, // returns array of excercise_group entries
        },
      });
    
      // 3. Filter exercises based on user's available equipments.
      const filteredExercises = exercises.filter((ex) => {
        if (ex.equipments.length === 0) return true;
        return ex.equipments.every(
          (eq) => eq.equipment_id === null || userEquipmentIds.includes(eq.equipment_id)
        );
      });
    
      // 4. Group exercises by exercise_cd.
      const exercisesByCd: Record<string, ExtendedExercise[]> = {};
      filteredExercises.forEach((ex: ExtendedExercise) => {
        if (!exercisesByCd[ex.exercise_cd]) {
          exercisesByCd[ex.exercise_cd] = [];
        }
        exercisesByCd[ex.exercise_cd].push(ex);
      });
    
      // 5. Build a flattened list of valid variants.
      let allValidVariants: ExtendedExercise[] = [];
      for (const cd in exercisesByCd) {
        const variants = exercisesByCd[cd];
        // If exercise has group info, filter by valid ones (difficulty <= user's level)
        let validVariants = variants.filter((v) => {
          if (v.group && v.group.length > 0) {
            const groupId = v.group[0].group_id;
            const userLevel = userGroupLevels[groupId] || 0;
            return v.group[0].difficulty !== null && v.group[0].difficulty <= userLevel;
          }
          return true; // if no group info, it's valid.
        });
        // If none pass the filter, fallback to all variants.
        if (validVariants.length === 0) {
          validVariants = variants;
        }
        // Sort variants descending by difficulty.
        validVariants.sort((a, b) => {
          const diffA = a.group && a.group.length > 0 ? a.group[0].difficulty || 0 : 0;
          const diffB = b.group && b.group.length > 0 ? b.group[0].difficulty || 0 : 0;
          return diffB - diffA;
        });
        allValidVariants.push(...validVariants);
      }
      // Sort the complete list by descending difficulty.
      allValidVariants.sort((a, b) => {
        const diffA = a.group && a.group.length > 0 ? a.group[0].difficulty || 0 : 0;
        const diffB = b.group && b.group.length > 0 ? b.group[0].difficulty || 0 : 0;
        return diffB - diffA;
      });
    
      // 6. Helper: Calculate rest time based on intensity.
      const getRestTime = (intensity: string): number => {
        switch (intensity.toLowerCase()) {
          case 'low': return 1;
          case 'medium': return 2;
          case 'high': return 4;
          case 'very high':
          case 'very_high': return 6;
          default: return 0;
        }
      };
    
      // 7. Annotate each valid variant with meta-data: points and totalTime per set.
      const exercisesWithMeta = allValidVariants.map((ex) => {
        const points = ex.muscles.reduce((sum, em) => sum + em.rating, 0);
        const totalTime = (ex.duration || 0) + getRestTime(ex.intensity);
        return { ...ex, points, totalTime };
      });
    
      // 8. Build weekly workout plans using overall (global) muscle balance.
      const workoutsPlan = [];
      const marginMultiplier = 1.2; // up to 20% over nominal minutes
      const globalMusclePoints: Record<string, number> = {};
      const allMuscleNames = (await this.databaseService.muscle.findMany()).map((m) => m.name);
      allMuscleNames.forEach((name) => (globalMusclePoints[name] = 0));
      const overallExerciseSetCount: Record<number, number> = {}; // now no cap on sets
    
      for (let i = 0; i < daysAvailable.length; i++) {
        const nominalTime = minutesAvailable[i];
        const timeLimit = nominalTime * marginMultiplier;
        let usedTime = 0;
        let dayExercises: { exercise: any; sets: number }[] = [];
        const computeImbalance = (mp: Record<string, number>): number => {
          const values = Object.values(mp);
          const avg = values.reduce((a, b) => a + b, 0) / values.length || 0;
          if (avg === 0) return Infinity;
          const max = Math.max(...values);
          const min = Math.min(...values);
          return (max - min) / avg;
        };
    
        while (usedTime < timeLimit) {
          const candidates = exercisesWithMeta.filter(
            (ex) => ex.totalTime <= timeLimit - usedTime
          );
          if (candidates.length === 0) break;
          let bestCandidate = null;
          let bestImbalance = Number.POSITIVE_INFINITY;
          let bestSets = 0;
          // Now, we allow as many sets as time permits; no fixed cap.
          for (const candidate of candidates) {
            // Determine the maximum sets that can fit in the remaining time.
            const maxByTime = Math.floor((timeLimit - usedTime) / candidate.totalTime);
            if (maxByTime < 1) continue;
            // Allow all possible sets for this candidate.
            const possibleSets = maxByTime;
            const simulatedGlobal = { ...globalMusclePoints };
            candidate.muscles.forEach((em) => {
              const muscleName = em.muscle.name;
              simulatedGlobal[muscleName] += em.rating * possibleSets;
            });
            const imbalance = computeImbalance(simulatedGlobal);
            if (imbalance < bestImbalance) {
              bestImbalance = imbalance;
              bestCandidate = candidate;
              bestSets = possibleSets;
            }
          }
          if (!bestCandidate) break;
          bestCandidate.muscles.forEach((em) => {
            const muscleName = em.muscle.name;
            globalMusclePoints[muscleName] += em.rating * bestSets;
          });
          // Accumulate sets for each exercise (without any cap).
          overallExerciseSetCount[bestCandidate.id] = (overallExerciseSetCount[bestCandidate.id] || 0) + bestSets;
          const existing = dayExercises.find((e) => e.exercise.id === bestCandidate.id);
          if (existing) {
            existing.sets += bestSets;
          } else {
            dayExercises.push({ exercise: bestCandidate, sets: bestSets });
          }
          usedTime += bestCandidate.totalTime * bestSets;
          if (usedTime >= nominalTime * 0.95) break;
        }
    
        // Reorder day exercises by group priority for effective grouping.
        // Define a custom priority order by group name.
        const groupPriority = ['leg push', 'leg pull', 'upper pull', 'horizontal push', 'side delt', 'bicep', 'tricep'];
        dayExercises.sort((a, b) => {
          const groupA = a.exercise.group && a.exercise.group.length > 0 ? a.exercise.group[0].group.name.toLowerCase() : '';
          const groupB = b.exercise.group && b.exercise.group.length > 0 ? b.exercise.group[0].group.name.toLowerCase() : '';
          const indexA = groupPriority.indexOf(groupA) === -1 ? 999 : groupPriority.indexOf(groupA);
          const indexB = groupPriority.indexOf(groupB) === -1 ? 999 : groupPriority.indexOf(groupB);
          return indexA - indexB;
        });
    
        let workoutDate = moment().day(daysAvailable[i]);
        if (workoutDate.isBefore(moment(), 'day')) workoutDate.add(7, 'days');
        workoutsPlan.push({
          date: workoutDate.toDate(),
          exercises: dayExercises,
          totalUsedTime: usedTime,
        });
      }
    
      // 9. Dummy load calculation: for weight, constant; for bodyweight, use the selected exercise's level (from group difficulty).
      const calculateLoad = (exercise: any) => {
        if (exercise.types === 'weight') return { weight: 10 };
        if (exercise.types === 'bodyweight')
          return { level: exercise.group && exercise.group.length > 0 ? exercise.group[0].difficulty : null };
        return {};
      };
    
      // 10. Save the weekly workout plan into the database.
      const savedWorkouts = [];
      for (const plan of workoutsPlan) {
        const workoutRecord = await this.databaseService.workout.create({
          data: { date: plan.date },
        });
        for (const item of plan.exercises) {
          const load = calculateLoad(item.exercise);
          await this.databaseService.workout_exercise.create({
            data: {
              workout_id: workoutRecord.id,
              exercise_id: item.exercise.id,
              set: item.sets,
              reps: 10,
              weight: load.weight || null,
            },
          });
        }
        savedWorkouts.push(workoutRecord);
      }
    
      // 11. Create a workoutperweek record and associate all saved workouts.
      const workoutPerWeekRecord = await this.databaseService.workoutperweek.create({
        data: { user_id: userId },
      });
      for (const workout of savedWorkouts) {
        await this.databaseService.workout_per_week_workout.create({
          data: {
            workout_id: workout.id,
            workoutperweek_id: workoutPerWeekRecord.id,
          },
        });
      }
      return workoutPerWeekRecord;
    }
    

    async getWorkoutPlan(workout_per_week_id: number) {
      // Retrieve the workout week, including the workouts and nested exercise details.
      const workoutWeek = await this.databaseService.workoutperweek.findUnique({
        where: { id: workout_per_week_id },
        include: {
          workouts: {
            include: {
              workout: {
                include: {
                  exercises: {
                    include: {
                      exercise: {
                        include: {
                          muscles: {
                            include: {
                              muscle: true,
                            },
                          },
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
    
      if (!workoutWeek) {
        throw new NotFoundException({
          statusCode: 404,
          message: `Workout plan with id ${workout_per_week_id} not found`,
        });
      }
    
      // Helper: Calculate rest time based on intensity.
      const getRestTime = (intensity: string): number => {
        switch (intensity.toLowerCase()) {
          case 'low':
            return 1;
          case 'medium':
            return 2;
          case 'high':
            return 4;
          case 'very high':
          case 'very_high':
            return 6;
          default:
            return 0;
        }
      };
    
      const workoutDetails = [];
      // Object to accumulate total points for each muscle.
      const musclePoints: Record<string, number> = {};
    
      // Iterate through each workout of the week.
      for (const wpw of workoutWeek.workouts) {
        const workout = wpw.workout;
        // Format the workout date using Moment.js (example: "monday, 2nd february 2025")
        const formattedDate = moment(workout.date).format('dddd, Do MMMM YYYY');
    
        const exercisesArr = [];
        let dayTotalDuration = 0; // Accumulate total duration for the day.
        // Iterate over each workout_exercise record for this workout.
        for (const we of workout.exercises) {
          const ex = we.exercise;
          // Calculate total duration per exercise: (exercise.duration + rest time) * number of sets.
          const exerciseDuration = ex.duration + getRestTime(ex.intensity);
          const totalDuration = exerciseDuration * we.set;
          dayTotalDuration += totalDuration;
          
          // Retrieve muscles hit and their ratings.
          const musclesHit = ex.muscles.map((em: any) => ({
            name: em.muscle.name,
            rating: em.rating,
          }));
    
          // Accumulate points for each muscle: (sets * rating).
          for (const m of musclesHit) {
            const points = we.set * m.rating;
            musclePoints[m.name] = (musclePoints[m.name] || 0) + points;
          }
    
          exercisesArr.push({
            name: ex.name,
            sets: we.set,
            reps: we.reps,
            weight: we.weight,
            totalDuration: totalDuration,
            musclesHit: musclesHit.map(m => m.name),
          });
        }
    
        workoutDetails.push({
          date: formattedDate,
          exercises: exercisesArr,
          totalWorkoutDuration: dayTotalDuration, // New field added.
        });
      }
    
      // Return the workouts along with the summary of total points per muscle.
      return {
        workouts: workoutDetails,
        musclePoints: musclePoints,
      };
    }
    


    async editEquipmentAvailabilities(
        body: {
            user_id: number,
            equipment_id: Array<number>,
        }
    ) {
        const { user_id, equipment_id } = body;
        await this.databaseService.user_equipment.deleteMany({
            where: {
                user_id: user_id
            }
        })
        for (let i = 0; i < equipment_id.length; i++) {
            await this.databaseService.user_equipment.create({
                data: {
                    user_id: user_id,
                    equipment_id: equipment_id[i],
                }
            })
        }
        return ({
            statusCode: 200,
            message: "equipment available edited sucessfully",
            data: equipment_id
        })
    }
    async editDaysAvailable(
        body: {
            user_id: number,
            days_available: Array<string>,
            minutes_available: Array<number>
        }
    ) {
        const { user_id, days_available, minutes_available } = body;
        await this.databaseService.user_availability.deleteMany({
            where: {
                user_id: user_id
            }
        })
        for (let i = 0; i < days_available.length; i++) {
            await this.databaseService.user_availability.create({
                data: {
                    user_id: user_id,
                    day: days_available[i],
                    minutes: minutes_available[i],
                }
            })
        }
        return ({
            statusCode: 200,
            message: "day available edited sucessfully",
            data: days_available
        })
    }

    async getUserEquipment(user_id: number) {
        const equipment = await this.databaseService.user_equipment.findMany({
            where: {
                user_id: user_id
            },
            include: {
                equipment: true
            }
        })

        return ({
            statusCode: 200,
            message: "user equipment get sucessfully",
            data: equipment
        })
    }

    async createProgress(progressInput: {
      user_id: number;
      workout_id: number;
      date: Date;
      exercises: {
        workout_exercise_id: number;
        sets: number;
        reps: number;
        weight_used?: number;
      }[];
    }) {
      const { user_id, workout_id, date, exercises } = progressInput;
    
      // Create a workout_progress record with nested exercise_progress entries.
      const newProgress = await this.databaseService.workout_progress.create({
        data: {
          user_id,
          workout_id,
          date,
          exerciseProgress: {
            create: exercises.map((ex) => ({
              workout_exercise_id: ex.workout_exercise_id,
              sets: ex.sets,
              reps: ex.reps,
              weight_used: ex.weight_used ?? null
            })),
          },
        },
        include: {
          exerciseProgress: true,
        },
      });
    
      // For each exercise progress submitted, update the user's level if needed.
      for (const exProgress of exercises) {
        // Retrieve the workout_exercise to get the associated exercise details.
        const we = await this.databaseService.workout_exercise.findUnique({
          where: { id: exProgress.workout_exercise_id },
          include: { 
            exercise: {
              include: { 
                group: true  // Retrieves associated excercise_group entries.
              } 
            } 
          },
        });
    
        if (!we) continue;
    
        const exercise = we.exercise;
    
        // Use the max_rep value from the exercise (or Infinity if not set).
        const maxRep = exercise.max_rep || Infinity;
    
        // If the user performed more reps than max_rep, level up the user in that exercise's group.
        if (exProgress.reps > maxRep) {
          // Ensure the exercise has an associated group.
          if (exercise.group && exercise.group.length > 0) {
            // We'll take the first group.
            const groupId = exercise.group[0].group_id;
            // Update the user's group level: increment level by 1.
            await this.databaseService.user_group_level.update({
              where: { 
                user_id_group_id: { user_id, group_id: groupId } 
              },
              data: { level: { increment: 1 } },
            });
          }
        }
      }
    
      return newProgress;
    }
    
      

    async getWorkoutForToday(userId: number): Promise<any> {
        // const startOfToday = moment().startOf('day').toDate();
        // const endOfToday = moment().endOf('day').toDate();

        const startOfToday = moment('20250303').toDate()
        const endOfToday = moment('20250304').toDate()
    
        // Find a workout scheduled for today that belongs to the user.
        // We check that there is at least one workout_per_week_workout linking this workout to a workoutperweek
        // record that has the given user_id.
        const workoutToday = await this.databaseService.workout.findFirst({
          where: {
            date: {
              gte: startOfToday,
              lte: endOfToday,
            },
            perWeek: {
              some: {
                workoutperweek: {
                  user_id: userId,
                },
              },
            },
          },
          include: {
            exercises: {
              include: {
                exercise: true, // Include exercise details (name, etc.)
              },
            },
          },
          // orderBy:{
          //   id:'desc'
          // }
        });
    
        if (!workoutToday) {
          return { message: 'No workout planned for today.' };
        }
    
        // Format the workout_exercise records for the response.
        const formattedExercises = workoutToday.exercises.map(we => ({
          workout_exercise_id: we.id,
          name: we.exercise.name,
          sets: we.set,
          // These values are to be filled in by the user after doing the workout:
          reps: null,
          weight_used: null,
          level_done: null,
        }));
    
        return {
          workout_id: workoutToday.id,
          date: workoutToday.date,
          exercises: formattedExercises,
        };
      }

    async getProgressByUser(userId: number) {
        const progressRecords = await this.databaseService.workout_progress.findMany({
            where: { user_id: userId },
            include: {
                workout: true,
                exerciseProgress: {
                    include: {
                        workout_exercise: {
                            include: {
                                exercise: {
                                    include: {
                                        muscles: {
                                            include: { muscle: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                date: 'desc',
            },
        });

        // Format the output.
        const formatted = progressRecords.map((wp) => {
            // Format the date (e.g., "Monday, 2nd February 2025")
            const formattedDate = moment(wp.date).format('dddd, Do MMMM YYYY');
            // Map each exercise progress entry.
            const exercises = wp.exerciseProgress.map((ep) => {
                const exercise = ep.workout_exercise.exercise;
                // Extract muscle names from exercise.muscles.
                const musclesHit = exercise.muscles.map((em) => em.muscle.name);
                return {
                    name: exercise.name,
                    sets: ep.sets,
                    reps: ep.reps,
                    weight_used: ep.weight_used,
                    musclesHit,
                    totalDuration: (exercise.duration + this.getRestTime(exercise.intensity)) * ep.sets,
                };
            });
            return {
                date: formattedDate,
                exercises,
            };
        });

        return formatted;
    }

    async getUserWorkouts(userId: number): Promise<any> {
      // Retrieve the workoutperweek records for the user, including nested workouts.
      const wpwRecords = await this.databaseService.workoutperweek.findMany({
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
                          group: { include: { group: true } },
                          equipments : true
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
    
      // Flatten workouts from all workoutperweek records.
      let workouts = [];
      wpwRecords.forEach((wpw) => {
        wpw.workouts.forEach((wEntry) => {
          workouts.push(wEntry.workout);
        });
      });
      if (workouts.length === 0)
        throw new NotFoundException(`No workouts found for user with id ${userId}`);
    
      // Sort workouts by date ascending.
      workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
      const formattedWorkouts = [];
      const musclePoints: Record<string, number> = {};
    
      for (const workout of workouts) {
        // Format the workout date using Moment.js.
        const formattedDate = moment(workout.date).format('dddd, Do MMMM YYYY');
        const exercisesArr = [];
        let dayTotalDuration = 0;
    
        // Iterate over each workout_exercise record.
        for (const we of workout.exercises) {
          const ex = we.exercise;
          const duration = ex.duration || 0;
          const restTime = duration ? this.getRestTime(ex.intensity) : 0;
          const totalDuration = (duration + restTime) * we.set;
          dayTotalDuration += totalDuration;
    
          // Retrieve muscles hit.
          const musclesHit = ex.muscles.map((em: any) => {
            const mName = em.muscle.name;
            musclePoints[mName] = (musclePoints[mName] || 0) + (we.set * em.rating);
            return mName;
          });
    
          // Get group info from the first excercise_group record if available.
          let groupInfo = null;
          if (ex.group && ex.group.length > 0 && ex.group[0].group) {
            groupInfo = {
              name: ex.group[0].group.name,
              difficulty: ex.group[0].difficulty || null,
            };
          }
    
          exercisesArr.push({
            workout_exercise_id: we.id,
            name: ex.name,
            sets: we.set,
            reps: we.reps,
            weight: we.weight,
            totalDuration: totalDuration,
            musclesHit: musclesHit,
            group: groupInfo,
          });
        }
    
        formattedWorkouts.push({
          date: formattedDate,
          exercises: exercisesArr,
          totalWorkoutDuration: dayTotalDuration,
        });
      }
    
      return {
        workouts: formattedWorkouts,
        musclePoints: musclePoints,
      };
    }

    async getWorkoutById(workoutId: number): Promise<any> {
      const workout = await this.databaseService.workout.findUnique({
        where: { id: workoutId },
        include: {
          exercises: {
            include: {
              exercise: {
                include: {
                  muscles: { include: { muscle: true } },
                  equipments: { include: { equipment: true } },  // <--- Include nested equipment
                  group: true,
                },
              },
            },
          },
        },
      });
      if (!workout)
        throw new NotFoundException(`Workout with id ${workoutId} not found`);
    
      // Format the workout date.
      const formattedDate = moment(workout.date).format('dddd, Do MMMM YYYY');
    
      // Map each workout_exercise to detailed information.
      const exercisesDetailed = workout.exercises.map((we) => {
        const ex = we.exercise;
        const duration = ex.duration || 0;
        const restTime = duration ? this.getRestTime(ex.intensity) : 0;
        const groupInfo = ex.group?.map((g) => ({
          group_id: g.group_id,
          difficulty: g.difficulty || null,
        })) || [];
        const musclesHit = ex.muscles.map((em) => ({
          name: em.muscle.name,
          rating: em.rating,
        }));
        // Now, map equipments using the nested 'equipment' relation.
        const equipmentsRequired = ex.equipments.map((eq) => eq.equipment.name);
      
        return {
          workout_exercise_id: we.id,
          name: ex.name,
          duration: duration,
          restTime: restTime,
          groupInfo,
          musclesHit,
          equipmentsRequired,
        };
      });
    
      return {
        workout_id: workout.id,
        date: formattedDate,
        exercises: exercisesDetailed,
      };
    }
    

    private getRestTime(intensity: string): number {
        switch (intensity.toLowerCase()) {
            case 'low': return 1;
            case 'medium': return 2;
            case 'high': return 4;
            case 'very high':
            case 'very_high': return 6;
            default: return 0;
        }
    }
}
