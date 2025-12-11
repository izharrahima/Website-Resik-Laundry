// Apps Script: Spreadsheet-as-Database (REST-like API)
// Bahasa: Indonesia
// Cara pakai: Simpan script ini di Google Apps Script yang "bound" ke Spreadsheet
// - Atau ubah SPREADSHEET_ID jika Anda mau memakai script "standalone".
// Fitur: CRUD sederhana (GET all / GET by id / POST create / POST update / POST delete)

const SHEET_NAME = 'Records'; // Nama tab sheet yang dipakai sebagai "tabel"
const API_KEY_PROPERTY = 'API_KEY'; // Nama property untuk menyimpan API key di PropertiesService

// ----------------------------- UTIL -----------------------------
function _getSpreadsheet() {
  // Jika script dijalankan sebagai bound script, gunakan aktif spreadsheet
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Untuk standalone script ganti dengan openById
    const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID tidak ditemukan. Jika ini standalone script, set property SPREADSHEET_ID.');
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
}

function _getSheet() {
  const ss = _getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // buat sheet baru dengan header default
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['id', 'type', 'transaction_date', 'customer_name', 'phone', 'service_type', 'member_type', 'weight', 'price_per_kg', 'items', 'total_amount', 'payment_status', 'description', 'category', 'account_debit', 'account_credit', 'amount', 'created_at'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function _readAll() {
  const sheet = _getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(h => String(h));
  const rows = data.slice(1);
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      let v = row[idx];
      // try parse JSON fields (items)
      if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
        try { v = JSON.parse(v); } catch (e) { /* leave as-is */ }
      }
      obj[h] = v;
    });
    return obj;
  });
}

function _findRowIndexById(id) {
  const sheet = _getSheet();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => r[0]);
  const idx = values.findIndex(v => String(v) === String(id));
  if (idx === -1) return -1;
  return idx + 2; // because data starts at row 2
}

function _appendRecord(obj) {
  const sheet = _getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Ensure id + created_at
  if (!obj.id) obj.id = 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  if (!obj.created_at) obj.created_at = new Date().toISOString();

  const row = headers.map(h => {
    const val = obj[h];
    if (Array.isArray(val) || (val && typeof val === 'object')) return JSON.stringify(val);
    return val == null ? '' : val;
  });
  sheet.appendRow(row);
  return obj;
}

function _updateRecord(id, patch) {
  const sheet = _getSheet();
  const rowIndex = _findRowIndexById(id);
  if (rowIndex === -1) return null;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const record = {};
  headers.forEach((h, i) => record[h] = currentRow[i]);

  const newRecord = Object.assign({}, record, patch);
  const rowValues = headers.map(h => {
    const v = newRecord[h];
    return (v == null) ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  });
  sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  return newRecord;
}

function _deleteRecord(id) {
  const sheet = _getSheet();
  const rowIndex = _findRowIndexById(id);
  if (rowIndex === -1) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

// ----------------------------- AUTH -----------------------------
function _checkApiKey(e) {
  // Try query params first then header-like field
  const allowed = ['api_key', 'apiKey', 'key'];
  const params = e.parameter || {};
  for (const k of allowed) if (params[k]) return params[k] === PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY);

  // allow passing header as Authorization: Bearer <key> (some environments might expose as parameter)
  if (e.headers && e.headers.Authorization) {
    const parts = e.headers.Authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1] === PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY);
  }
  return false;
}

// ----------------------------- RESPONSES -----------------------------
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------- HANDLERS (Public WebApp endpoints) -----------------------------
function doGet(e) {
  // GET /?id=<id>  -> single
  // GET / -> list
  try {
    if (!PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY)) {
      return _json({ ok: false, message: 'API key belum diset. Set properti script API_KEY terlebih dahulu.' });
    }
    if (!_checkApiKey(e)) return _json({ ok: false, message: 'Unauthorized. Sertakan api_key parameter atau Bearer token.' });

    const id = e.parameter && e.parameter.id;
    const all = _readAll();
    if (id) {
      const rec = all.find(r => String(r.id) === String(id));
      return _json({ ok: !!rec, data: rec || null });
    }

    // optional filter by type => /?type=transaction
    if (e.parameter && e.parameter.type) {
      const t = e.parameter.type;
      return _json({ ok: true, data: all.filter(r => String(r.type) === String(t)) });
    }

    return _json({ ok: true, data: all });
  } catch (err) {
    return _json({ ok: false, message: err.message });
  }
}

function doPost(e) {
  // POST create: body JSON {record: {...}} or raw object
  // POST update/delete: use query param action=update|delete and include id in JSON
  try {
    if (!PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY)) {
      return _json({ ok: false, message: 'API key belum diset. Set properti script API_KEY terlebih dahulu.' });
    }
    if (!_checkApiKey(e)) return _json({ ok: false, message: 'Unauthorized. Sertakan api_key parameter atau Bearer token.' });

    const action = (e.parameter && e.parameter.action) || 'create';
    const raw = (e.postData && e.postData.contents) || '';
    const body = raw ? JSON.parse(raw) : {};

    if (action === 'create') {
      const rec = (body.record) ? body.record : body;
      if (!rec || typeof rec !== 'object') return _json({ ok: false, message: 'payload tidak valid' });
      const r = _appendRecord(rec);
      return _json({ ok: true, data: r });
    }

    if (action === 'update') {
      const id = body.id || (body.record && body.record.id);
      const patch = body.patch || (body.record ? body.record : body);
      if (!id) return _json({ ok: false, message: 'id diperlukan untuk update' });
      const updated = _updateRecord(id, patch);
      if (!updated) return _json({ ok: false, message: 'data tidak ditemukan' });
      return _json({ ok: true, data: updated });
    }

    if (action === 'delete') {
      const id = body.id || (body.record && body.record.id);
      if (!id) return _json({ ok: false, message: 'id diperlukan untuk delete' });
      const ok = _deleteRecord(id);
      return _json({ ok: ok, message: ok ? 'dihapus' : 'tidak ditemukan' });
    }

    return _json({ ok: false, message: 'action tidak dikenali' });

  } catch (err) {
    return _json({ ok: false, message: err.message });
  }
}

// ----------------------------- ADMIN helpers -----------------------------
function setApiKey(key) {
  // dipanggil dari editor (Run) sekali untuk menyimpan API key
  if (!key) throw new Error('Sertakan key');
  PropertiesService.getScriptProperties().setProperty(API_KEY_PROPERTY, String(key));
  return { ok: true };
}

function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY) || null;
}

/*
  Contoh pemakaian (dari client):
  GET list:
    GET https://script.google.com/macros/s/DEPLOY_ID/exec?api_key=YOUR_KEY
  GET single:
    GET https://script.google.com/macros/s/DEPLOY_ID/exec?id=rec_...&api_key=YOUR_KEY

  CREATE:
    POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=create&api_key=YOUR_KEY
    body JSON: { "record": { "type":"transaction", "id":"TRX123", ... } }

  UPDATE:
    POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=update&api_key=YOUR_KEY
    body JSON: { "id": "TRX123", "patch": { "payment_status":"lunas" } }

  DELETE:
    POST https://script.google.com/macros/s/DEPLOY_ID/exec?action=delete&api_key=YOUR_KEY
    body JSON: { "id": "TRX123" }
*/