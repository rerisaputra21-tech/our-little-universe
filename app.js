// Our Little Universe — konfigurasi Firebase diisi oleh pemilik proyek.
// Jangan pernah menaruh service-account key atau rahasia server di file ini.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, addDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getBlob, deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

// Ganti nilai contoh ini dengan konfigurasi dari Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: "AIzaSyBVdICxp3yYLbr53aW6o353c8-JKaFmvUw",
  authDomain: "our-little-universe-81fc2.firebaseapp.com",
  projectId: "our-little-universe-81fc2",
  storageBucket: "our-little-universe-81fc2.firebasestorage.app",
  messagingSenderId: "172499613281",
  appId: "1:172499613281:web:dc6f8e5399f4ed7f7b5c20",
};

const $ = (id) => document.getElementById(id);
const loginPanel = $("loginPanel");
const appPanel = $("appPanel");
const loginMessage = $("loginMessage");
const uploadMessage = $("uploadMessage");
const gallery = $("gallery");
const galleryStatus = $("galleryStatus");
const objectUrls = new Map();
let app, auth, db, storage, currentUser = null, currentRole = "member", allMemories = [];

function showMessage(el, message, isError = true) {
  el.textContent = message;
  el.style.color = isError ? "#a34b3e" : "#356b4b";
}
function friendlyError(error) {
  const code = error?.code || "";
  const known = {
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "permission-denied": "Akses ditolak oleh aturan keamanan. Periksa keanggotaan dan Security Rules.",
    "storage/unauthorized": "Akses foto ditolak oleh aturan penyimpanan.",
    "storage/cors-unsupported": "Browser tidak dapat mengambil foto karena konfigurasi CORS bucket."
  };
  return known[code] || "Terjadi kendala. Periksa konfigurasi Firebase dan coba lagi.";
}
function configIsReady() {
  return firebaseConfig.apiKey !== "ISI_API_KEY" &&
    firebaseConfig.projectId !== "ISI_PROJECT_ID" &&
    firebaseConfig.appId !== "ISI_APP_ID";
}
function safeText(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || "";
  return node;
}

if (!configIsReady()) {
  showMessage(loginMessage, "Website belum terhubung ke Firebase. Isi konfigurasi Firebase di app.js terlebih dahulu.");
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage(loginMessage, "Memeriksa akun…", false);
    try {
      await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
      showMessage(loginMessage, "", false);
    } catch (error) {
      showMessage(loginMessage, friendlyError(error));
    }
  });

  $("signOutBtn").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      currentRole = "member";
      loginPanel.classList.remove("hidden");
      appPanel.classList.add("hidden");
      $("signOutBtn").classList.add("hidden");
      clearObjectUrls();
      return;
    }
    try {
      const memberSnap = await getDoc(doc(db, "members", user.uid));
      if (!memberSnap.exists() || memberSnap.data().active !== true) {
        await signOut(auth);
        showMessage(loginMessage, "Akun ini belum diundang atau sudah dinonaktifkan admin.");
        return;
      }
      currentRole = memberSnap.data().role === "admin" ? "admin" : "member";
      loginPanel.classList.add("hidden");
      appPanel.classList.remove("hidden");
      $("signOutBtn").classList.remove("hidden");
      $("welcomeText").textContent = `Selamat datang, ${memberSnap.data().displayName || user.email}`;
      $("adminUpload").classList.toggle("hidden", currentRole !== "admin");
      await loadMemories();
    } catch (error) {
      await signOut(auth);
      showMessage(loginMessage, friendlyError(error));
    }
  });

  $("searchInput").addEventListener("input", renderMemories);
  $("yearFilter").addEventListener("change", renderMemories);

  $("uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || currentRole !== "admin") {
      showMessage(uploadMessage, "Hanya admin yang boleh mengunggah pada versi awal ini.");
      return;
    }
    const file = $("photoFile").files[0];
    const title = $("photoTitle").value.trim();
    const date = $("photoDate").value;
    const note = $("photoNote").value.trim();
    if (!file || !title || !date) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showMessage(uploadMessage, "Pilih foto JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage(uploadMessage, "Ukuran foto maksimal 5 MB.");
      return;
    }
    const submitButton = event.submitter;
    submitButton.disabled = true;
    showMessage(uploadMessage, "Mengunggah foto…", false);
    const id = crypto.randomUUID();
    const storagePath = `familyPhotos/${id}`;
    try {
      await uploadBytes(ref(storage, storagePath), file, {
        contentType: file.type,
        customMetadata: { ownerUid: currentUser.uid }
      });
      await addDoc(collection(db, "memories"), {
        title, date, note, storagePath, contentType: file.type,
        size: file.size, createdBy: currentUser.uid, createdAt: serverTimestamp()
      });
      $("uploadForm").reset();
      showMessage(uploadMessage, "Foto berhasil ditambahkan.", false);
      await loadMemories();
    } catch (error) {
      // Bersihkan file jika upload berhasil tetapi metadata gagal dibuat.
      try { await deleteObject(ref(storage, storagePath)); } catch (_) {}
      showMessage(uploadMessage, friendlyError(error));
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function loadMemories() {
  gallery.replaceChildren();
  galleryStatus.textContent = "Memuat kenangan…";
  try {
    const snap = await getDocs(query(collection(db, "memories"), orderBy("date", "desc")));
    allMemories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const years = [...new Set(allMemories.map(m => (m.date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
    const yearSelect = $("yearFilter");
    const prior = yearSelect.value;
    yearSelect.replaceChildren(new Option("Semua tahun", "all"));
    years.forEach(year => yearSelect.add(new Option(year, year)));
    if (years.includes(prior)) yearSelect.value = prior;
    renderMemories();
  } catch (error) {
    galleryStatus.textContent = friendlyError(error);
  }
}

function renderMemories() {
  gallery.replaceChildren();
  const term = $("searchInput").value.trim().toLowerCase();
  const year = $("yearFilter").value;
  const filtered = allMemories.filter(m =>
    (year === "all" || (m.date || "").startsWith(year)) &&
    `${m.title || ""} ${m.note || ""} ${m.date || ""}`.toLowerCase().includes(term)
  );
  galleryStatus.textContent = filtered.length ? `${filtered.length} kenangan` : "Belum ada kenangan yang cocok. Admin bisa menambahkan foto pertama.";
  filtered.forEach((memory) => {
    const card = document.createElement("article");
    card.className = "memory-card";
    const image = document.createElement("img");
    image.className = "memory-image";
    image.alt = `Foto kenangan: ${memory.title || "Keluarga"}`;
    image.loading = "lazy";
    image.src = objectUrls.get(memory.storagePath) || "";
    card.append(image);
    const body = document.createElement("div");
    body.className = "memory-body";
    body.append(safeText("div", formatDate(memory.date), "memory-date"));
    body.append(safeText("h3", memory.title));
    if (memory.note) body.append(safeText("p", memory.note));
    if (currentRole === "admin") {
      const del = safeText("button", "Hapus kenangan", "delete-btn");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm(`Hapus "${memory.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
        del.disabled = true;
        try {
          await deleteDoc(doc(db, "memories", memory.id));
          try { await deleteObject(ref(storage, memory.storagePath)); } catch (_) {}
          const url = objectUrls.get(memory.storagePath);
          if (url) URL.revokeObjectURL(url);
          objectUrls.delete(memory.storagePath);
          await loadMemories();
        } catch (error) {
          alert(friendlyError(error));
          del.disabled = false;
        }
      });
      body.append(del);
    }
    card.append(body);
    gallery.append(card);
    if (!objectUrls.has(memory.storagePath)) loadPrivateImage(memory.storagePath, image);
  });
}
async function loadPrivateImage(path, img) {
  try {
    // getBlob memakai sesi Firebase dan Security Rules; tidak membuat URL unduhan publik permanen.
    const blob = await getBlob(ref(storage, path), 5 * 1024 * 1024);
    const url = URL.createObjectURL(blob);
    objectUrls.set(path, url);
    img.src = url;
  } catch (error) {
    img.alt = "Foto tidak dapat dimuat. Periksa izin Storage dan CORS.";
    img.style.display = "none";
    console.warn("Foto gagal dimuat:", error?.code || error);
  }
}
function clearObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
function formatDate(value) {
  if (!value) return "Tanggal belum diisi";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("id-ID", {day:"numeric", month:"long", year:"numeric"}).format(d);
}
