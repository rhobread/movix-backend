import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  // Redirects the user to Microsoft’s login page
  @Get('login')
  @UseGuards(AuthGuard('azure-ad'))
  login() {
    console.log("inside login endpoint")
    // The guard will redirect to Microsoft
  }

  // The callback URL configured in Azure AD
  @Get('redirect/microsoft')
  @UseGuards(AuthGuard('azure-ad'))
  redirect(@Req() req) {
    console.log("inside redirect endpoint.")
    return {
      message: 'Login successful',
      user: req.user,
    };
  }

  @Get('refresh/:refresh_token')
  async refresh(@Param('refresh_token') refresh_token: string) {
    return this.authService.refreshAccessToken(refresh_token)
  }

}
