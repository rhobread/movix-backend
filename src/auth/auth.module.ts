import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { AzureStrategy } from './strategies/azure.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'azure-ad', session: true })],
  controllers: [AuthController],
  providers: [AuthService, AzureStrategy],
})
export class AuthModule { }
