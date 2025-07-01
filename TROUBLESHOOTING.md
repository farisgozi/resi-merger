# Troubleshooting Guide - PDF Merger Deployment

## 🚨 Masalah yang Terjadi

### 1. CLI Command Error
**Error**: `appwrite client set-project` tidak valid
**Solusi**: Gunakan `appwrite client --project-id` dengan flag

### 2. Configuration Conflicts  
**Error**: Konflik antara konfigurasi remote dan lokal
```
id                   │ key           │ remote        │ local        
──────────────────────┼───────────────┼───────────────┼─────────────
68617ea70030b8ef6bbe │ scopes        │ users.read    │ any          
──────────────────────┼───────────────┼───────────────┼─────────────
68617ea70030b8ef6bbe │ timeout       │ 15            │ 900          
──────────────────────┼───────────────┼───────────────┼─────────────
68617ea70030b8ef6bbe │ specification │ s-1vcpu-512mb │ s-1vcpu-1gb  
```

### 3. Session Authentication Issues
**Error**: `Session not found. Please run 'appwrite login' to create a session`
**Status**: Login berhasil tetapi session tidak persistent

## 🛠️ Solusi yang Tersedia

### Option 1: Manual Deployment (Recommended)
```bash
./deploy_manual.sh
```
Kemudian ikuti instruksi untuk upload manual melalui web console.

### Option 2: API Deployment
```bash
export APPWRITE_API_KEY='your_api_key'
./deploy_api.sh
```

### Option 3: Fix CLI dan Deploy
1. Restart terminal/session
2. Login ulang: `appwrite login`
3. Jalankan: `./deploy_enhanced.sh`

## 📋 Manual Deployment Steps

1. **Buka Appwrite Console**:
   https://cloud.appwrite.io/console/project-6861b5e20027ba386475/functions/function-68617ea70030b8ef6bbe

2. **Update Function Settings**:
   - Runtime: Python 3.12
   - Timeout: 900 seconds
   - Memory: s-1vcpu-1gb
   - Execute: any
   - Scopes: any

3. **Create New Deployment**:
   - Upload files: `src/main.py`, `src/utils.py`, `requirements.txt`
   - Entrypoint: `src/main.py`
   - Build commands: `apt-get update && apt-get install -y poppler-utils && pip install -r requirements.txt`

4. **Activate Deployment**

## 🧪 Testing

Setelah deployment berhasil:

```bash
python3 test_function.py
```

Atau test manual dengan cURL:

```bash
curl -X POST \
  https://syd.cloud.appwrite.io/v1/functions/68617ea70030b8ef6bbe/executions \
  -H 'Content-Type: application/json' \
  -H 'X-Appwrite-Project: 6861b5e20027ba386475' \
  -d '{
    "files": [
      {
        "filename": "test.pdf",
        "content": "base64_encoded_pdf_here"
      }
    ]
  }'
```

## 🔧 Next Steps

1. **Deploy function** menggunakan salah satu metode di atas
2. **Test function** dengan script test yang sudah dibuat
3. **Monitor logs** di Appwrite Console untuk debugging
4. **Optimize** performance berdasarkan hasil testing

## 📞 Support

Jika masih mengalami masalah:
1. Check Appwrite Console logs
2. Verify API permissions
3. Contact Appwrite support atau community forum
