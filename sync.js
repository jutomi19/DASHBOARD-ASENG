// =============================================
// SYNC.JS - Sinkronisasi Cloud dengan JSONBin.io
// =============================================

const BIN_KEY = 'latoto_jsonbin_bin';
const API_KEY_KEY = 'latoto_jsonbin_key';

// Ambil API Key dari localStorage atau minta user
function getApiKey() {
  let key = localStorage.getItem(API_KEY_KEY);
  if (!key) {
    key = prompt('🔑 Masukkan JSONBin API Key (dapatkan dari jsonbin.io):');
    if (key) localStorage.setItem(API_KEY_KEY, key);
  }
  return key;
}

// Ambil Bin ID
function getBinId() {
  return localStorage.getItem(BIN_KEY);
}

// Simpan Bin ID
function setBinId(id) {
  localStorage.setItem(BIN_KEY, id);
}

// Kirim data ke cloud
async function syncData(collection, data) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('❌ Tidak ada API Key, sync gagal');
    return false;
  }

  let binId = getBinId();

  try {
    // Jika belum punya bin, buat baru
    if (!binId) {
      const res = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': apiKey
        },
        body: JSON.stringify({ [collection]: data })
      });
      const result = await res.json();
      if (result.metadata && result.metadata.id) {
        setBinId(result.metadata.id);
        console.log('📦 Bin baru dibuat:', result.metadata.id);
        return true;
      } else {
        console.error('Gagal membuat bin:', result);
        return false;
      }
    }

    // Update bin yang sudah ada
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
      },
      body: JSON.stringify({ [collection]: data })
    });

    if (res.ok) {
      console.log(`✅ ${collection} berhasil disinkronkan ke cloud`);
      return true;
    } else {
      const err = await res.json();
      console.error('Gagal update bin:', err);
      return false;
    }
  } catch (e) {
    console.error('Sync error:', e);
    return false;
  }
}

// Ambil data dari cloud
async function loadFromBin(collection) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const binId = getBinId();
  if (!binId) return null;

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!res.ok) {
      console.warn('Gagal mengambil data dari cloud, status:', res.status);
      return null;
    }
    const result = await res.json();
    if (result.record && result.record[collection]) {
      return result.record[collection];
    }
    return null;
  } catch (e) {
    console.error('Load error:', e);
    return null;
  }
}

// Fungsi untuk memulai sinkronisasi otomatis
function startSync(collection, dataRef, saveFn, interval = 5000) {
  // Pertama, coba ambil data dari cloud
  loadFromBin(collection).then(remoteData => {
    if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
      const currentStr = JSON.stringify(dataRef);
      const remoteStr = JSON.stringify(remoteData);
      if (currentStr !== remoteStr) {
        // Update data lokal dengan data cloud
        dataRef.splice(0, dataRef.length, ...remoteData);
        saveFn(); // simpan ke localStorage
        console.log(`📥 Data ${collection} dimuat dari cloud`);
        // Panggil toast jika ada
        if (typeof toast === 'function') toast('Data dimuat dari cloud');
      }
    }
  });

  // Set interval untuk polling
  let intervalId = setInterval(() => {
    loadFromBin(collection).then(remoteData => {
      if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
        const currentStr = JSON.stringify(dataRef);
        const remoteStr = JSON.stringify(remoteData);
        if (currentStr !== remoteStr) {
          dataRef.splice(0, dataRef.length, ...remoteData);
          saveFn();
          console.log(`🔄 Data ${collection} disinkronkan dari cloud`);
          if (typeof toast === 'function') toast('Data disinkronkan dari cloud');
        }
      }
    });
  }, interval);

  // Kembalikan fungsi save yang baru (akan otomatis sync ke cloud)
  const newSave = function() {
    saveFn(); // save ke localStorage
    syncData(collection, dataRef); // sync ke cloud
  };

  return { newSave, intervalId };
}

// Fungsi untuk menghentikan polling (opsional)
function stopSync(intervalId) {
  if (intervalId) clearInterval(intervalId);
}