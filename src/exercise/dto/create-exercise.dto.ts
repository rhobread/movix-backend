export class CreateExerciseDto {
    name: string;
    exercise_cd: string;
    type: string; // 'bodyweight', 'weight', 'isometric'
    max_rep?: number;
    intensity: string;
    duration?: number;
    image?: string;
    description?: string;
    group_id?: number; // Optional group association\n  difficulty?: number; // Difficulty for the exercise in that group\n  muscles?: { muscle_id: number; rating: number }[]; // Array of muscle associations\n  equipments?: number[]; // Array of equipment IDs needed
  }
  