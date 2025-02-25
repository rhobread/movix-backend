import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'querystring';

@Injectable()
export class AuthService {

    async refreshAccessToken(refreshToken: string): Promise<any> {
        const tokenEndpoint = `https://login.microsoftonline.com/common/oauth2/v2.0/token`;

        // Prepare the data according to the OAuth 2.0 refresh token flow.
        const requestData = {
            client_id: process.env.AZURE_CLIENT_ID,
            client_secret: process.env.AZURE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'User.Read Files.ReadWrite.All offline_access', // Adjust scopes as needed.
        };

        try {
            const response = await axios.post(tokenEndpoint, qs.stringify(requestData), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            console.log(response)
            // The response will include a new access token (and possibly a new refresh token).
            return response.data;
        } catch (error) {
            console.error('Error refreshing access token:', error.response?.data || error.message);
            throw error;
        }
    }
}
