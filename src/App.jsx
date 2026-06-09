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
import { styled } from "@mui/material/styles";
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
    primary: { main: "#e8eaeb" },
    background: { default: "#111418", paper: "#1c2228" },
    text: { primary: "#e8eaeb", secondary: "#8fa3b2" },
    divider: "rgba(255,255,255,0.07)",
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h5: { fontWeight: 800, letterSpacing: "-0.03em" },
    h6: { fontWeight: 700, letterSpacing: "-0.02em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#1c2228",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root fieldset": { borderColor: "rgba(255,255,255,0.1)" },
          "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "rgba(255,255,255,0.18)" },
          "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: "rgba(255,255,255,0.35)" },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
        contained: {
          backgroundColor: "#e8eaeb",
          color: "#111418",
          "&:hover": { backgroundColor: "#fff" },
        },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: "none" } } },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#1c2228",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      },
    },
  },
});

// ── Search (fora do componente para não recriar a cada render) ──
const SearchWrap = styled("div")({
  position: "relative",
  display: "flex",
  alignItems: "center",
  borderRadius: 7,
  backgroundColor: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.07)",
  transition: "background 0.15s, border-color 0.15s",
  "&:focus-within": {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.18)",
  },
});

const SearchIconBox = styled("div")({
  padding: "0 10px 0 12px",
  position: "absolute",
  top: 0, bottom: 0,
  display: "flex",
  alignItems: "center",
  pointerEvents: "none",
  color: "rgba(255,255,255,0.35)",
});

const SearchInput = styled("input")({
  color: "#e8eaeb",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: "8px 12px 8px 38px",
  width: "24ch",
  fontSize: "0.875rem",
  fontFamily: "inherit",
  "&::placeholder": { color: "rgba(255,255,255,0.28)" },
});

// ── Utilitários ──
function extractNameFromUrl(url) {
  if (!url) return null;
  try {
    const raw = url.startsWith("http") ? url : "https://" + url;
    const { pathname } = new URL(raw);
    const patterns = [
      /\/leitor\/([^/]+)\/\d+/,
      /\/manga\/([^/]+)\/cap-/,
      /\/comics?\/([^/]+)\/cap-/,
      /\/serie\/([^/]+)\/cap-/,
      /\/comicz\/([^/]+)\/cap-/,
      /\/ler\/([^/]+)\/(?:online|cap-)/,
      /\/capitulos\/(.+?)-capitulo-/,
    ];
    for (const re of patterns) {
      const m = pathname.match(re);
      if (m) {
        const name = m[1]
          .replace(/[_-]/g, " ")
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

// ── Migração coleção antiga → users/{uid}/books ──
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
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
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
        alert("Erro no upload. Verifique as regras do Firebase Storage.");
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
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentBook(book);
    setOpenForm(true);
  };

  // Loading
  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>Carregando…</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // ── Tela de login ──
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
            background: "#111418",
            gap: 2,
          }}
        >
          {/* Logo */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            <Typography sx={{ fontSize: "1.6rem", lineHeight: 1 }}>📚</Typography>
          </Box>

          <Typography
            variant="h5"
            sx={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0" }}
          >
            ChapterKeeper
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", mb: 2 }}>
            Sua biblioteca pessoal
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={handleSignIn}
            sx={{
              px: 4,
              py: 1.2,
              fontSize: "0.9rem",
              borderRadius: "8px",
              letterSpacing: "0.01em",
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
            background: "rgba(17, 20, 24, 0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: "52px !important" }}>
            <Typography
              variant="h6"
              sx={{ flexGrow: 1, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              ChapterKeeper
            </Typography>

            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontSize: "0.8rem", display: { xs: "none", sm: "block" } }}
            >
              {books.length} {books.length === 1 ? "livro" : "livros"}
            </Typography>

            <SearchWrap>
              <SearchIconBox>
                <SearchIcon sx={{ fontSize: 16 }} />
              </SearchIconBox>
              <SearchInput
                placeholder="Buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </SearchWrap>

            <Tooltip title={user.displayName || user.email}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                <Avatar src={user.photoURL} alt={user.displayName} sx={{ width: 30, height: 30 }} />
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <MenuItem disabled sx={{ fontSize: "0.78rem", opacity: "1 !important", color: "text.secondary" }}>
                {user.email}
              </MenuItem>
              <MenuItem onClick={handleSignOut} sx={{ fontSize: "0.88rem" }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                Sair
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Grade de cards */}
        <Container maxWidth="xl" sx={{ pt: 3 }}>
          <div className="catalog">
            {filtered.map((book) => (
              <div
                key={book.id}
                className="catalog-card"
                onClick={() => window.open(book.url, "_blank")}
                onContextMenu={(e) => openEdit(book, e)}
              >
                {/* Imagem de capa (se houver) */}
                {book.imageUrl && (
                  <img
                    src={book.imageUrl}
                    alt={book.title}
                    className="card-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}

                {/* Overlay com info */}
                <div className={`card-overlay${book.imageUrl ? "" : " card-overlay--full"}`}>
                  <span className="card-title">{book.title}</span>
                  <span className="card-meta">
                    {book.chapter && `Cap. ${book.chapter}`}
                    {book.updatedAt && (
                      <span className="card-date">{formatDate(book.updatedAt)}</span>
                    )}
                  </span>
                </div>

                {/* Botão editar no hover */}
                <div className="card-edit-btn" onClick={(e) => openEdit(book, e)} title="Editar">
                  <EditIcon sx={{ fontSize: 13 }} />
                </div>
              </div>
            ))}

            {/* Card de adicionar */}
            <div
              className="catalog-card catalog-card--add"
              onClick={() => { setCurrentBook(null); setOpenForm(true); }}
            >
              <AddIcon sx={{ fontSize: 26, color: "rgba(255,255,255,0.28)" }} />
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
