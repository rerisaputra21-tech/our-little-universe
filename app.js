
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Konfigurasi Firebase proyek kamu
const firebaseConfig = {
  apiKey: "AIzaSyBVdICxp3yYLbr53aW6o353c8-JKaFmvUw",
  authDomain: "our-little-universe-81fc2.firebaseapp.com",
  projectId: "our-little-universe-81fc2",
  messagingSenderId: "172499613281",
  appId: "1:172499613281:web:dc6f8e5399f4ed7f7b5c20"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
let currentUser = null;
let currentRole = "member";
let allMemories = [];

function showMessage(el, message, isError = true) {
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#a34b3e" : "#356b4b";
}

function friendlyError(error) {
  const code = error?.code || "";
  const known = {
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "permission-denied": "Akses ditolak oleh Security Rules Firestore.",
    "resource-exhausted": "Batas ukuran atau kuota Firestore tercapai."
  };
  return known[code] || `Terjadi kendala: ${code || error?.message || "Coba lagi."}`;
}

function safeText(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || "";
  return node;
}

const loginPanel = $("loginPanel");
const appPanel = $("appPanel");
const loginMessage = $("loginMessage");
const uploadMessage = $("uploadMessage");
const gallery = $("gallery");
const galleryStatus = $("galleryStatus");

$("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(loginMessage, "Memeriksa akun…", false);

  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );
  } catch (error) {
    showMessage(loginMessage, friendlyError(error));
  }
});

$("signOutBtn")?.addEventListener("click", () => signOut(auth));
$("searchInput")?.addEventListener("input", renderMemories);
$("yearFilter")?.addEventListener("change", renderMemories);

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    currentRole = "member";
    loginPanel?.classList.remove("hidden");
    appPanel?.classList.add("hidden");
    $("signOutBtn")?.classList.add("hidden");
    return;
  }

  try {
    const memberSnap = await getDoc(doc(db, "members", user.uid));

    if (!memberSnap.exists() || memberSnap.data().active !== true) {
      await signOut(auth);
      showMessage(
        loginMessage,
        "Akun belum diundang atau sudah dinonaktifkan admin."
      );
      return;
    }

    currentRole = memberSnap.data().role === "admin" ? "admin" : "member";
    loginPanel?.classList.add("hidden");
    appPanel?.classList.remove("hidden");
    $("signOutBtn")?.classList.remove("hidden");

    $("welcomeText").textContent =
      `Selamat datang, ${memberSnap.data().displayName || user.email}`;

    $("adminUpload")?.classList.toggle("hidden", currentRole !== "admin");
    await loadMemories();
  } catch (error) {
    await signOut(auth);
    showMessage(loginMessage, friendlyError(error));
  }
});

// Kompres foto menjadi JPEG kecil agar sesuai batas Firestore.
async function compressPhoto(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar yang valid.");
  }

  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxSide = 700;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  let quality = 0.55;
  let blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  while (blob && blob.size > 450 * 1024 && quality > 0.2) {
    quality -= 0.1;
    blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  if (!blob || blob.size > 450 * 1024) {
    throw new Error("Foto masih terlalu besar. Pilih foto lain.");
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

$("uploadForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || currentRole !== "admin") {
    showMessage(uploadMessage, "Hanya admin yang boleh mengunggah foto.");
    return;
  }

  const file = $("photoFile").files[0];
  const title = $("photoTitle").value.trim();
  const date = $("photoDate").value;
  const note = $("photoNote").value.trim();

  if (!file || !title || !date) {
    showMessage(uploadMessage, "Lengkapi foto, judul, dan tanggal.");
    return;
  }

  const button = event.submitter;
  if (button) button.disabled = true;
  showMessage(uploadMessage, "Mengompres dan menyimpan foto…", false);

  try {
    const photoData = await compressPhoto(file);

    await addDoc(collection(db, "memories"), {
      title,
      date,
      note,
      photoData,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    $("uploadForm").reset();
    showMessage(uploadMessage, "Foto berhasil ditambahkan.", false);
    await loadMemories();
  } catch (error) {
    showMessage(uploadMessage, friendlyError(error));
  } finally {
    if (button) button.disabled = false;
  }
});

async function loadMemories() {
  gallery?.replaceChildren();
  if (galleryStatus) galleryStatus.textContent = "Memuat kenangan…";

  try {
    const snap = await getDocs(
      query(collection(db, "memories"), orderBy("date", "desc"))
    );

    allMemories = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const years = [
      ...new Set(
        allMemories.map(m => (m.date || "").slice(0, 4)).filter(Boolean)
      )
    ].sort().reverse();

    const yearSelect = $("yearFilter");
    if (yearSelect) {
      const prior = yearSelect.value;
      yearSelect.replaceChildren(new Option("Semua tahun", "all"));
      years.forEach(year => yearSelect.add(new Option(year, year)));
      if (years.includes(prior)) yearSelect.value = prior;
    }

    renderMemories();
  } catch (error) {
    if (galleryStatus) galleryStatus.textContent = friendlyError(error);
  }
}

function renderMemories() {
  if (!gallery || !galleryStatus) return;

  gallery.replaceChildren();

  const term = ($("searchInput")?.value || "").trim().toLowerCase();
  const year = $("yearFilter")?.value || "all";

  const filtered = allMemories.filter(memory =>
    (year === "all" || (memory.date || "").startsWith(year)) &&
    `${memory.title || ""} ${memory.note || ""} ${memory.date || ""}`
      .toLowerCase().includes(term)
  );

  galleryStatus.textContent = filtered.length
    ? `${filtered.length} kenangan`
    : "Belum ada kenangan yang cocok.";

  filtered.forEach(memory => {
    const card = document.createElement("article");
    card.className = "memory-card";

    const image = document.createElement("img");
    image.className = "memory-image";
    image.alt = `Foto kenangan: ${memory.title || "Keluarga"}`;
    image.loading = "lazy";
    image.src = memory.photoData || "";
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
        if (!confirm(`Hapus "${memory.title}"? Tindakan ini tidak bisa dibatalkan.`)) {
          return;
        }

        del.disabled = true;

        try {
          await deleteDoc(doc(db, "memories", memory.id));
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
  });
}

function formatDate(value) {
  if (!value) return "Tanggal belum diisi";

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);
}
