Panduan singkat: Mengubah Google Spreadsheet menjadi "database" (Apps Script)

Ringkasan
- File: Code.gs (Apps Script) — menyediakan REST-like API CRUD untuk sheet bernama `Records`.
- Keunggulan: bisa dipasang sebagai bound script di spreadsheet Anda (direkomendasikan) atau standalone dengan SPREADSHEET_ID.

Langkah cepat (bound script - lebih mudah)
1. Buka Google Sheets (spreadsheet Anda).
2. Menu: Extensions → Apps Script.
3. Hapus kode yang ada (atau buat file baru) lalu paste isi `apps_script_Code.gs` ke project.
4. Simpan.
5. Atur API key sekali: di Apps Script Editor panggil fungsi `setApiKey('kunci-rahasia-anda')` melalui menu Run (ikon ▶️). Anda akan diminta memberi izin.
6. Deploy sebagai Web App: Deploy → New Deployment → Pilih `Web app`,
   - Execute as: Me (agar skrip bisa akses spreadsheet)
   - Who has access: Anyone (atau Anyone with link) — untuk testing. Untuk produksi, pertimbangkan kontrol lebih ketat.
7. Salin URL deploy (exec endpoint). Gunakan `?api_key=<YOUR_KEY>` pada querystring, atau sertakan Authorization Bearer header.

Contoh pemanggilan
- Ambil semua record:
  GET https://script.google.com/macros/s/DEPLOY_ID/exec?api_key=YOUR_KEY

- Ambil record by id:
  GET https://script.google.com/macros/s/DEPLOY_ID/exec?id=rec_...&api_key=YOUR_KEY

- Buat record:
  POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=create&api_key=YOUR_KEY
  Body JSON: { "record": { "type":"transaction", "id":"TRX123", "transaction_date":"2025-11-25T...", "customer_name":"Ibu A", ... } }

- Update record:
  POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=update&api_key=YOUR_KEY
  Body JSON: { "id": "TRX123", "patch": { "payment_status": "lunas" } }

- Delete record:
  POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=delete&api_key=YOUR_KEY
  Body JSON: { "id": "TRX123" }

Tips keamanan
- Jangan publish API key di tempat umum.
- Untuk produksi, pertimbangkan menambahkan validasi input dan rate limiting.

Catatan: Jika ingin script standalone (bukan bound) set properti "SPREADSHEET_ID" di menu Project Settings > Script properties, atau jalankan function setScriptProperty('SPREADSHEET_ID','id_spreadsheet').

Jika ingin, saya dapat buatkan contoh frontend (fetch) yang memanggil API ini dari `index.html` Anda dan contoh data impor dari Google Sheet ke UI. Beri tahu saya apakah mau saya lanjutkan.
