# WhatsApp PDF Merger Bot

A WhatsApp bot built with Baileys that integrates with our Appwrite PDF Merger function to allow users to merge PDF files directly through WhatsApp.

## Features

- 📱 WhatsApp integration using Baileys
- 📄 Support for multiple PDF files
- 🔗 Automatic PDF merging with smart layout optimization
- 📲 File upload/download through WhatsApp
- ⚡ Fast processing via Appwrite serverless functions
- 🛡️ File size and type validation
- 🧹 Automatic cleanup of temporary files

## Prerequisites

- Node.js 18+ 
- Appwrite account with PDF Merger function deployed
- WhatsApp account for bot

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Appwrite credentials
   ```

3. **Set up environment variables:**
   ```env
   APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_api_key
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   FUNCTION_ID=pdf-merger
   BOT_PREFIX=.pdf
   ```

## Usage

### Starting the Bot

```bash
npm start
```

1. Scan the QR code with WhatsApp
2. Bot will connect and be ready to receive messages

### Using the Bot

1. **Start a merge session:**
   ```
   .pdf
   ```

2. **Send PDF files:**
   - Send PDF files one by one
   - Bot will confirm each file received
   - Maximum file size: 25MB per file

3. **Merge files:**
   ```
   .pdf merge
   ```

4. **Confirm merge:**
   - Bot will ask for confirmation
   - Reply with "yes" to proceed

5. **Receive merged PDF:**
   - Bot will send the merged PDF file
   - Optimized with smart layout and cropping

### Commands

- `.pdf` - Start PDF merge session
- `.pdf merge` - Process collected PDFs  
- `.pdf cancel` - Cancel current session
- `help` - Show help message

## File Processing

The bot integrates with our Appwrite PDF Merger function which:

- Crops left margins for better layout
- Removes bottom 17.25% for header/footer cleanup  
- Applies 1.08x enlargement for readability
- Optimizes page layout automatically

## Error Handling

- File type validation (PDF only)
- File size limits (25MB max)
- Session timeout management
- Automatic cleanup on errors
- Graceful reconnection handling

## Development

### Local Development

```bash
# Start with auto-reload
npm run dev
```

### File Structure

```
whatsapp-bot/
├── index.js          # Main bot application
├── package.json      # Dependencies and scripts
├── .env.example      # Environment template
├── .gitignore        # Git ignore rules
├── README.md         # This file
├── auth_info/        # WhatsApp session data (auto-generated)
└── temp/             # Temporary file storage (auto-generated)
```

### Key Components

- **WhatsAppPDFBot class**: Main bot logic
- **Session Management**: Tracks user PDF merge sessions
- **File Handling**: Download, validate, and cleanup PDFs
- **API Integration**: Calls Appwrite PDF Merger function
- **Message Handlers**: Process text and document messages

## Deployment to Appwrite

To deploy this bot as an Appwrite Function:

1. **Create new Node.js function in Appwrite:**
   ```bash
   # In Appwrite console, create new function
   # Runtime: Node.js 18+
   # Trigger: HTTP (for webhook) or Manual
   ```

2. **Deploy the code:**
   ```bash
   # Zip the whatsapp-bot directory
   zip -r whatsapp-bot.zip whatsapp-bot/
   # Upload to Appwrite Function
   ```

3. **Set environment variables in Appwrite:**
   - `APPWRITE_PROJECT_ID`
   - `APPWRITE_API_KEY` 
   - `FUNCTION_ID`
   - `BOT_PREFIX`

4. **Configure function settings:**
   - Memory: 512MB+ (for PDF processing)
   - Timeout: 300s (5 minutes)
   - Permissions: Storage read/write, Database read/write

## Security Notes

- Bot requires API key with appropriate permissions
- Temporary files are automatically cleaned up
- Sessions have timeout protection
- File size and type validation prevents abuse

## Troubleshooting

### Connection Issues
- Check WhatsApp session validity
- Verify QR code scanning
- Restart bot if connection drops

### PDF Processing Errors
- Verify Appwrite function is deployed and working
- Check API credentials and permissions
- Monitor function logs in Appwrite console

### File Upload Issues
- Ensure files are valid PDFs
- Check file size limits (25MB max)
- Verify WhatsApp media download permissions

## API Integration

The bot communicates with our Appwrite PDF Merger function:

**Endpoint:** `/functions/pdf-merger/executions`

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Files: PDF files as form data
- Headers: Appwrite project and API key

**Response:**
```json
{
  "job_id": "unique_job_id",
  "message": "PDF merge completed",
  "download_url": "https://storage.url/merged.pdf"
}
```

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check Appwrite function logs
2. Verify bot console output
3. Test PDF Merger API directly
4. Check WhatsApp connection status
