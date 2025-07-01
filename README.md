# PDF Merger - Appwrite Function

Aplikasi untuk menggabungkan beberapa file PDF menjadi satu file PDF dengan layout grid yang rapi. Berjalan sebagai Appwrite Function dengan dukungan serverless.

## 🚀 Fitur

- **Multi PDF Merge**: Menggabungkan beberapa file PDF menjadi satu
- **Grid Layout**: Mengatur receipt/dokumen dalam layout grid (3x2 default)
- **Image Processing**: Crop dan resize otomatis untuk hasil optimal
- **Base64 Support**: Input dan output dalam format base64
- **Serverless Ready**: Dioptimasi untuk environment serverless
- **Error Handling**: Penanganan error yang komprehensif
- **CORS Support**: Mendukung cross-origin requests

## 📋 Konfigurasi Appwrite

- **Project ID**: `6861b5e20027ba386475`
- **Function ID**: `68617ea70030b8ef6bbe`
- **Endpoint**: `https://syd.cloud.appwrite.io/v1`
- **Runtime**: Python 3.12
- **Timeout**: 900 seconds
- **Memory**: 1GB

## 🛠️ Dependencies

- `appwrite` - Appwrite SDK
- `reportlab` - PDF generation
- `pdf2image` - PDF to image conversion
- `Pillow` - Image processing
- `PyPDF2` - PDF manipulation
- `poppler-utils` - System dependency untuk pdf2image

## 📁 Struktur Project

```
resi-merger/
├── src/
│   ├── main.py          # Entry point Appwrite Function
│   └── utils.py         # PDF processing utilities
├── appwrite.json        # Konfigurasi Appwrite
├── requirements.txt     # Python dependencies
├── deploy.sh           # Script deployment
├── test_function.py    # Script testing
└── README.md          # Dokumentasi
```

## 🚀 Deployment

### 1. Install Appwrite CLI

```bash
npm install -g appwrite-cli
```

### 2. Login ke Appwrite

```bash
appwrite login
```

### 3. Deploy Function

```bash
./deploy.sh
```

Atau manual:

```bash
appwrite client set-project 6861b5e20027ba386475
appwrite client set-endpoint https://syd.cloud.appwrite.io/v1
appwrite deploy function
```

## 🧪 Testing

### 1. Menggunakan Script Test

```bash
python3 test_function.py
```

### 2. Manual Testing dengan cURL

```bash
curl -X POST \
  https://syd.cloud.appwrite.io/v1/functions/68617ea70030b8ef6bbe/executions \
  -H 'Content-Type: application/json' \
  -H 'X-Appwrite-Project: 6861b5e20027ba386475' \
  -d '{
    "files": [
      {
        "filename": "receipt1.pdf",
        "content": "base64_encoded_pdf_content_here"
      },
      {
        "filename": "receipt2.pdf", 
        "content": "base64_encoded_pdf_content_here"
      }
    ]
  }'
```

## 📄 API Usage

### Request Format

```json
{
  "files": [
    {
      "filename": "receipt1.pdf",
      "content": "JVBERi0xLjQK..." // base64 encoded PDF
    },
    {
      "filename": "receipt2.pdf",
      "content": "JVBERi0xLjQK..." // base64 encoded PDF
    }
  ]
}
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "message": "Successfully merged 2 PDFs",
  "file": {
    "filename": "merged_receipts.pdf",
    "content": "JVBERi0xLjQK...", // base64 encoded merged PDF
    "size": 12345
  }
}
```

#### Error Response

```json
{
  "error": "Error message description"
}
```

## ⚙️ Configuration

### Grid Layout (dalam utils.py)

```python
rows = 3          # Jumlah baris per halaman
cols = 2          # Jumlah kolom per halaman  
h_padding = 20    # Padding horizontal
v_padding = 20    # Padding vertikal
```

### Crop Settings

```python
crop_width = img_w // 2     # Lebar crop (setengah dari lebar asli)
crop_ratio = 0.7275         # Rasio crop vertikal
enlargement_factor = 1.08   # Faktor pembesaran
```

## 🔧 Troubleshooting

### 1. Function Timeout

Jika processing memakan waktu lama, pertimbangkan:
- Mengurangi DPI pada pdf2image (default: 150)
- Menggunakan fallback PyPDF2 untuk PDF besar
- Meningkatkan timeout function

### 2. Memory Issues

- Gunakan single thread processing
- Optimize image compression
- Cleanup temporary files

### 3. poppler-utils Installation

Pastikan poppler-utils terinstall dengan benar:

```bash
apt-get update && apt-get install -y poppler-utils
```

## 📊 Performance

- **Single PDF**: ~1-2 detik
- **Multiple PDFs (5-10)**: ~5-15 detik
- **Memory Usage**: ~200-500MB
- **Max File Size**: Tergantung Appwrite limits

## 🔐 Security

- Function dapat diakses tanpa autentikasi (scope: "any")
- Validasi format PDF pada input
- Temporary file cleanup otomatis
- CORS headers untuk web access

## 📝 Logs

Monitor function execution melalui:
- Appwrite Console > Functions > PDF Merger > Executions
- Real-time logs tersedia selama development

## 🤝 Contributing

1. Fork repository
2. Buat feature branch
3. Commit changes
4. Push ke branch
5. Buat Pull Request

## 📄 License

MIT License - lihat file LICENSE untuk detail lengkap.
