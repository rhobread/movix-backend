import { Body, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer'
import * as fs from 'fs'


@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) { }
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<any, any>,
  ) {
    const { folderPath, accessToken } = body
    const fileBuffer = fs.readFileSync(file.path)
    const uploadedFile = {
      buffer: fileBuffer,
      originalname: file.originalname,
      mimetype: file.mimetype
    }
    const result = await this.fileService.uploadFile(
      accessToken,
      folderPath,
      uploadedFile,
    );
    return result;
  }


  @Post('upload-memory')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage()
  }))
  async uploadFileMemory(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<any, any>,
  ) {
    const { folderPath, accessToken } = body
    const result = await this.fileService.uploadFile(
      accessToken,
      folderPath,
      file,
    );
    return result;
  }
}
