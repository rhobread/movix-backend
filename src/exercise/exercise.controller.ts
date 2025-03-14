import { Controller, Get, Post, Body, Patch, Param, NotFoundException } from '@nestjs/common';
import { ExerciseService } from './exercise.service';

@Controller('exercise')
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Post()
  async create(@Body() createExerciseDto: Record<any,any>) {
    return await this.exerciseService.createExercise(createExerciseDto);
  }

  @Get('groups')
  async getGroups() {
    return await this.exerciseService.getGroups();
  }

  @Get('muscles')
  async getMuscles() {
    return await this.exerciseService.getMuscles();
  }

  @Get('equipments')
  async getEquipments() {
    return await this.exerciseService.getEquipments();
  }

  // 1. Get all exercises grouped by exercise_cd
  // Get all exercises grouped by exercise_cd
  @Get()
  async getAllGrouped() {
    return this.exerciseService.getAllGrouped();
  }

  // Get a single exercise by id
  @Get(':id')
  async getOne(@Param('id') id: number) {
    return this.exerciseService.findOne(Number(id));
  }

  // Update an exercise (only allowed fields)
  @Patch(':id')
  async updateExercise(
    @Param('id') id: number,
    @Body() updateExerciseDto: Record<any,any>,
  ) {
    return this.exerciseService.updateExercise(Number(id), updateExerciseDto);
  }
}
