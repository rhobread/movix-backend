// src/auth/azure.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy, IStrategyOptionWithRequest } from 'passport-azure-ad';

@Injectable()
export class AzureStrategy extends PassportStrategy(OIDCStrategy, 'azure-ad') {
    constructor() {
        super({
            identityMetadata: `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`,
            clientID: process.env.AZURE_CLIENT_ID,
            responseType: 'code',
            responseMode: 'query',
            redirectUrl: process.env.AZURE_REDIRECT_URI,
            allowHttpForRedirectUrl: true, // Only for development; use HTTPS in production.
            clientSecret: process.env.AZURE_CLIENT_SECRET,
            validateIssuer: false,
            passReqToCallback: false,
            scope: ['profile', 'offline_access', 'User.Read', 'Files.ReadWrite.All'],
            prompt: 'login',
        } as IStrategyOptionWithRequest,

            async (iss, sub, profile, accessToken, refreshToken, params, done) => {
                // This callback is called after Microsoft returns a response.
                // `params` may include additional tokens such as id_token.
                console.log("inside strategy")
                if (!profile) {
                    return done(new Error('No profile found'), null);
                }
                // const email =
                //   profile._json?.email ||
                //   profile._json?.preferred_username ||
                //   profile.upn;
                // if (!email) {
                //   return done(new UnauthorizedException('Email not found in profile'), null);
                // }
                //     const appUser = await this.prisma.user.findUnique({
                //         where: { email },
                //       });

                //       if (!user) {
                //         return done(new UnauthorizedException('Please register first'), null);
                //       }
                // Optionally, store the tokens along with the profile.
                const user = {
                    profile,
                    accessToken,
                    refreshToken,
                };
                return done(null, user);
            });
    }
}
