import { Injectable } from '@nestjs/common';
import axios from 'axios'

@Injectable()
export class FileService {

    async uploadFile(
        accessToken: string,
        folderPath: string,
        file
    ) {
        // Construct the OneDrive path.
        // If folderPath is provided, include it; otherwise, use the file name alone.
        const path = folderPath ? `${folderPath}/${file.originalname}` : file.originalname;

        // Build the Microsoft Graph API endpoint for file upload.
        // The endpoint format is: /me/drive/root:/{item-path}:/content
        const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
            path,
        )}:/content`;

        try {
            const response = await axios.put(url, file.buffer, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': file.mimetype,
                },
            });
            return response.data;
        } catch (error) {
            // In production, improve error handling.
            console.error('Error uploading file to OneDrive:' + error);
            return error;
        }
    }
}
