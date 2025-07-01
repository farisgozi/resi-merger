# 🚀 Heroku Deployment Guide - WhatsApp PDF Merger Bot

Panduan lengkap untuk deploy WhatsApp PDF Merger Bot ke Heroku dengan monitoring logs dan QR code.

## 📋 Prerequisites

1. **Heroku CLI** - Install dari: https://devcenter.heroku.com/articles/heroku-cli
2. **Git** - Pastikan git sudah terinstall
3. **Node.js** - Versi 18 atau lebih baru
4. **Appwrite Account** - Dengan project dan API key yang aktif

## 🛠️ Setup Step by Step

### 1. Install Heroku CLI

```bash
# Ubuntu/Debian
curl https://cli-assets.heroku.com/install.sh | sh

# macOS
brew tap heroku/brew && brew install heroku

# Windows
# Download dari: https://devcenter.heroku.com/articles/heroku-cli#download-and-install
```

### 2. Login ke Heroku

```bash
heroku login
```

### 3. Prepare Project

```bash
cd /home/joy/resi-merger/whatsapp-bot

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"
```

### 4. Create Heroku App

```bash
# Option 1: Using our automated script
./deploy-heroku.sh

# Option 2: Manual creation
heroku create your-whatsapp-bot-name --region us
heroku git:remote -a your-whatsapp-bot-name
```

### 5. Set Environment Variables

**❗ PENTING: Ganti dengan credentials Appwrite Anda**

```bash
heroku config:set APPWRITE_PROJECT_ID=6861b5e20027ba386475 -a your-app-name
heroku config:set APPWRITE_API_KEY=your_api_key_here -a your-app-name
heroku config:set APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1 -a your-app-name
heroku config:set PDF_MERGER_FUNCTION_ID=68617ea70030b8ef6bbe -a your-app-name
heroku config:set BOT_PREFIX=.pdf -a your-app-name
heroku config:set NODE_ENV=production -a your-app-name
```

### 6. Deploy ke Heroku

```bash
git push heroku main
```

## 📱 Monitoring QR Code & Logs

### Real-time Logs (Untuk melihat QR Code)

```bash
heroku logs --tail -a your-app-name
```

### One-time Log View

```bash
heroku logs -a your-app-name
```

### Web-based Log Viewer

1. Buka: https://dashboard.heroku.com/apps/your-app-name
2. Klik tab "More" → "View logs"

## 📋 QR Code Authentication Process

1. **Deploy app** dan tunggu hingga selesai
2. **Monitor logs** dengan: `heroku logs --tail -a your-app-name`
3. **QR code akan muncul** dalam logs saat pertama kali startup
4. **Scan QR code** dengan WhatsApp di phone Anda:
   - Buka WhatsApp
   - Tap menu 3 titik (⋮)
   - Pilih "Linked Devices"
   - Tap "Link a Device"
   - Scan QR code yang muncul di logs

## 🔧 Troubleshooting

### QR Code tidak muncul

```bash
# Restart app
heroku restart -a your-app-name

# Check logs
heroku logs --tail -a your-app-name
```

### App crash/tidak running

```bash
# Check app status
heroku ps -a your-app-name

# Scale up if needed
heroku ps:scale web=1 -a your-app-name
```

### Authentication hilang

```bash
# Clear auth dan restart (akan generate QR baru)
heroku restart -a your-app-name
```

## 📊 Useful Heroku Commands

```bash
# View app info
heroku info -a your-app-name

# View config vars
heroku config -a your-app-name

# View dyno status
heroku ps -a your-app-name

# Scale dynos
heroku ps:scale web=1 -a your-app-name

# Open app in browser
heroku open -a your-app-name

# View releases
heroku releases -a your-app-name

# Rollback to previous release
heroku rollback -a your-app-name
```

## 🎯 Production Tips

### 1. Keep Alive (Prevent dyno sleeping)

Heroku free dynos sleep after 30 minutes. Untuk production:

```bash
# Upgrade to paid plan
heroku ps:type hobby -a your-app-name
```

### 2. Monitor Resource Usage

```bash
# View metrics
heroku logs --ps router -a your-app-name
```

### 3. Environment Variables Management

```bash
# Add/update env vars
heroku config:set KEY=value -a your-app-name

# Remove env var
heroku config:unset KEY -a your-app-name
```

## 📱 Bot Usage After Deployment

1. **Authentication**: Bot akan generate QR code di logs saat startup
2. **Commands**: 
   - Send `.pdf` untuk memulai merge session
   - Send PDF files (dokumen WhatsApp)
   - Reply "yes" untuk konfirmasi merge
3. **Monitoring**: Gunakan `heroku logs --tail` untuk monitoring real-time

## 🔐 Security Notes

- ✅ Environment variables tersimpan aman di Heroku
- ✅ Auth info tidak masuk git repository
- ✅ API keys tidak exposed dalam code
- ❗ Monitor logs untuk aktivitas suspicious

## 📞 Support

Jika ada masalah deployment:

1. Check logs: `heroku logs --tail -a your-app-name`
2. Restart app: `heroku restart -a your-app-name`
3. Verify config: `heroku config -a your-app-name`

Happy deployment! 🚀
