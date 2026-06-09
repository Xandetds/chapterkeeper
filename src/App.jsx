import React, { useState, useEffect, useCallback } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Tooltip,
  createTheme,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import { styled, alpha } from "@mui/material/styles";
import BookForm from "./components/BookForm";
import "./catalog.css";
import { db, auth, googleProvider, storage } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

// ── MUI Theme ──
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7c5cfc" },
    secondary: { main: "#00d4ff" },
    background: { default: "#0d0d12", paper: "#16161f" },
    text: { primary: "#f0f0ff", secondary: "#8080a0" },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h5: { fontWeight: 800, letterSpacing: "-0.03em" },
    h6: { fontWeight: 700, letterSpacing: "-0.02em" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.06)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root fieldset": {
            borderColor: "rgba(255,255,255,0.1)",
          },
          "& .MuiOutlinedInput-root:hover fieldset": {
            borderColor: "rgba(255,255,255,0.2)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: { textTransform: "none", fontWeight: 600 },
        outlined: { textTransform: "none" },
        text: { textTransform: "none" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { backgroundImage: "none", border: "1px solid rgba(255,255,255,0.07)" },
      },
    },
  },
});

// ── Search bar (fora do componente para não recriar a cada render) ──
const SearchWrap = styled("div")(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  borderRadius: 8,
  backgroundColor: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.08)",
  transition: "background 0.15s ease, border-color 0.15s ease",
  "&:focus-within": {
    backgroundColor: "rgba(255,255,255,0.11)",
    borderColor: "rgba(124, 92, 252, 0.5)",
  },
  marginLeft: theme.spacing(2),
}));

const SearchIconBox = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  color: "rgba(255,255,255,0.4)",
}));

const SearchInput = styled("input")(({ theme }) => ({
  color: "#f0f0ff",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: "8px 12px 8px 40px",
  width: "26ch",
  fontSize: "0.88rem",
  fontFamily: "inherit",
  "::placeholder": { color: "rgba(255,255,255,0.3)" },
}));

// ── Gradientes para cards sem imagem ──
const GRADIENTS = [
  "linear-gradient(160deg, #1a1040 0%, #4c1d95 100%)",
  "linear-gradient(160deg, #0f1f3d 0%, #1e429f 100%)",
  "linear-gradient(160deg, #0e2a1a 0%, #065f46 100%)",
  "linear-gradient(160deg, #3b0a0a 0%, #991b1b 100%)",
  "linear-gradient(160deg, #0e1f2a 0%, #0369a1 100%)",
  "linear-gradient(160deg, #1e0a3b 0%, #6d28d9 100%)",
  "linear-gradient(160deg, #0d2626 0%, #0f766e 100%)",
  "linear-gradient(160deg, #2a1505 0%, #b45309 100%)",
  "linear-gradient(160deg, #1a0e2a 0%, #86198f 100%)",
  "linear-gradient(160deg, #0a1a1f 0%, #0e7490 100%)",
];

function getGradient(id = "", title = "") {
  const s = id || title;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

// ── Utilitários ──
function extractNameFromUrl(url) {
  if (!url) return null;
  try {
    const raw = url.startsWith("http") ? url : "https://" + url;
    const { pathname } = new URL(raw);
    const patterns = [
      { re: /\/leitor\/([^/]+)\/\d+/, sep: "_" },
      { re: /\/manga\/([^/]+)\/cap-/ },
      { re: /\/comics?\/([^/]+)\/cap-/ },
      { re: /\/serie\/([^/]+)\/cap-/ },
      { re: /\/comicz\/([^/]+)\/cap-/ },
      { re: /\/ler\/([^/]+)\/(?:online|cap-)/ },
      { re: /\/capitulos\/(.+?)-capitulo-/ },
    ];
    for (const { re, sep } of patterns) {
      const m = pathname.match(re);
      if (m) {
        let name = m[1]
          .replace(sep === "_" ? /_/g : /-/g, " ")
          .replace(/\d+_\d+[\w_]*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        if (name.length > 3) return name;
      }
    }
  } catch (_) {}
  return null;
}

function cleanTitle(title, url) {
  if (!title) return extractNameFromUrl(url) || url || "Sem título";
  const looksLikeUrl =
    title.startsWith("http") ||
    /^[a-z0-9-]+\.(net|com|org|top|xyz|online|br|cc)/.test(title) ||
    /\.(net|com|org|top)\//.test(title);
  return looksLikeUrl ? extractNameFromUrl(url) || title : title;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff}d atrás`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem`;
  return d.toLocaleDateString("pt-BR");
}

// ── Migração da coleção antiga ──
async function migrateOldData(uid) {
  const oldSnap = await getDocs(collection(db, "books"));
  if (oldSnap.empty) return;
  const userRef = collection(db, "users", uid, "books");
  const userSnap = await getDocs(userRef);
  if (!userSnap.empty) return;
  for (let i = 0; i < oldSnap.docs.length; i += 240) {
    const batch = writeBatch(db);
    oldSnap.docs.slice(i, i + 240).forEach((od) => {
      const { id: _, ...rest } = od.data();
      batch.set(doc(userRef), {
        ...rest,
        title: cleanTitle(rest.title, rest.url),
        imageUrl: rest.imageUrl || "",
        updatedAt: new Date(),
      });
      batch.delete(od.ref);
    });
    await batch.commit();
  }
}

// ── App ──
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [currentBook, setCurrentBook] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const fetchBooks = useCallback(async (uid) => {
    await migrateOldData(uid);
    const snap = await getDocs(collection(db, "users", uid, "books"));
    const list = snap.docs.map((d) => {
      const { id: _, ...data } = d.data();
      return { id: d.id, ...data };
    });
    list.sort((a, b) => {
      const ta = a.updatedAt?.toDate?.() ?? new Date(a.updatedAt ?? 0);
      const tb = b.updatedAt?.toDate?.() ?? new Date(b.updatedAt ?? 0);
      return tb - ta;
    });
    setBooks(list);
  }, []);

  useEffect(() => {
    if (user) fetchBooks(user.uid);
    else setBooks([]);
  }, [user, fetchBooks]);

  const handleSignIn = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleSignOut = () => { setAnchorEl(null); signOut(auth); };

  const saveBook = async (book, imageFile = null) => {
    let imageUrl = book.imageUrl || "";
    if (imageFile) {
      try {
        const storageRef = ref(storage, `users/${user.uid}/covers/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.error(err);
        alert("Erro no upload da imagem. Verifique as regras do Firebase Storage.");
        return;
      }
    }

    const payload = {
      title: book.title,
      chapter: book.chapter || "",
      url: book.url,
      imageUrl,
      updatedAt: serverTimestamp(),
    };

    if (book.id) {
      await updateDoc(doc(db, "users", user.uid, "books", book.id), payload);
      const now = new Date();
      setBooks((prev) =>
        prev
          .map((b) => (b.id === book.id ? { ...book, ...payload, updatedAt: now } : b))
          .sort((a, b) => {
            const ta = a.updatedAt?.toDate?.() ?? new Date(a.updatedAt ?? 0);
            const tb = b.updatedAt?.toDate?.() ?? new Date(b.updatedAt ?? 0);
            return tb - ta;
          })
      );
    } else {
      const docRef = await addDoc(collection(db, "users", user.uid, "books"), payload);
      setBooks((prev) => [{ id: docRef.id, ...payload, updatedAt: new Date() }, ...prev]);
    }
  };

  const deleteBook = async (bookId) => {
    await deleteDoc(doc(db, "users", user.uid, "books", bookId));
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  const filtered = books.filter((b) =>
    (b.title || "").toLowerCase().includes(query.toLowerCase())
  );

  const openEdit = (book, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCurrentBook(book);
    setOpenForm(true);
  };

  // ── Loading ──
  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <Typography sx={{ color: "text.secondary" }}>Carregando…</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // ── Login ──
  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at 50% 40%, rgba(124,92,252,0.12) 0%, transparent 70%), #0d0d12",
            gap: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontSize: "2.4rem", color: "#f0f0ff" }}>
            ChapterKeeper
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 3 }}>
            Sua biblioteca pessoal
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleSignIn}
            sx={{
              background: "linear-gradient(135deg, #7c5cfc, #5b8af5)",
              px: 5,
              py: 1.4,
              fontSize: "0.95rem",
              borderRadius: "10px",
              boxShadow: "0 4px 24px rgba(124,92,252,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #8f72fd, #6e9af8)",
                boxShadow: "0 6px 30px rgba(124,92,252,0.5)",
              },
            }}
          >
            Entrar com Google
          </Button>
        </Box>
      </ThemeProvider>
    );
  }

  // ── App principal ──
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>

        {/* Navbar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: "rgba(13,13,18,0.82)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1, fontSize: "1.1rem" }}>
              ChapterKeeper
            </Typography>

            {/* Contagem */}
            <Typography variant="body2" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }}>
              {books.length} {books.length === 1 ? "livro" : "livros"}
            </Typography>

            {/* Busca */}
            <SearchWrap>
              <SearchIconBox>
                <SearchIcon sx={{ fontSize: 18 }} />
              </SearchIconBox>
              <SearchInput
                placeholder="Buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </SearchWrap>

            {/* Avatar */}
            <Tooltip title={user.displayName || user.email}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5, p: 0.5 }}>
                <Avatar src={user.photoURL} alt={user.displayName} sx={{ width: 32, height: 32 }} />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled sx={{ fontSize: "0.8rem", opacity: "1 !important", color: "text.secondary" }}>
                {user.email}
              </MenuItem>
              <MenuItem onClick={handleSignOut}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                Sair
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Grade */}
        <Container maxWidth="xl" sx={{ pt: 3 }}>
          <div className="catalog">
            {filtered.map((book) => (
              <div
                key={book.id}
                className="catalog-card"
                style={{ background: getGradient(book.id, book.title) }}
                onClick={() => window.open(book.url, "_blank")}
                onContextMenu={(e) => openEdit(book, e)}
              >
                {book.imageUrl && (
                  <img
                    src={book.imageUrl}
                    alt={book.title}
                    className="card-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}

                <div className={`card-overlay${book.imageUrl ? "" : " card-overlay--full"}`}>
                  <span className="card-title">{book.title}</span>
                  <span className="card-meta">
                    {book.chapter && `Cap. ${book.chapter}`}
                  </span>
                  {book.updatedAt && (
                    <span className="card-date">{formatDate(book.updatedAt)}</span>
                  )}
                </div>

                {/* Botão de editar (hover) */}
                <div
                  className="card-edit-btn"
                  onClick={(e) => openEdit(book, e)}
                  title="Editar"
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </div>
              </div>
            ))}

            {/* Card adicionar */}
            <div
              className="catalog-card catalog-card--add"
              onClick={() => { setCurrentBook(null); setOpenForm(true); }}
            >
              <AddIcon sx={{ fontSize: 30, color: "rgba(124,92,252,0.7)" }} />
              <span>Adicionar</span>
            </div>
          </div>
        </Container>

        <BookForm
          open={openForm}
          handleClose={() => setOpenForm(false)}
          saveBook={saveBook}
          deleteBook={deleteBook}
          currentBook={currentBook}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
