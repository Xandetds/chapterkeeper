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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
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

// ── MUI Theme: dark navy/purple ──
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#8c78ff" },
    background: { default: "#0d0c1a", paper: "#141420" },
    text: { primary: "#dcd7f5", secondary: "#5a5878" },
    divider: "rgba(140, 120, 255, 0.1)",
  },
  typography: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    button: { textTransform: "none", fontWeight: 500, letterSpacing: "0.01em" },
  },
  shape: { borderRadius: 7 },
  components: {
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#141420",
          border: "1px solid rgba(140, 120, 255, 0.12)",
          borderRadius: 10,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root fieldset": {
            borderColor: "rgba(140, 120, 255, 0.12)",
          },
          "& .MuiOutlinedInput-root:hover fieldset": {
            borderColor: "rgba(140, 120, 255, 0.25)",
          },
          "& .MuiOutlinedInput-root.Mui-focused fieldset": {
            borderColor: "rgba(140, 120, 255, 0.5)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
        contained: {
          backgroundColor: "#8c78ff",
          color: "#0d0c1a",
          fontWeight: 600,
          "&:hover": { backgroundColor: "#a090ff" },
        },
        outlined: {
          borderColor: "rgba(140, 120, 255, 0.22)",
          color: "#dcd7f5",
          "&:hover": { borderColor: "rgba(140, 120, 255, 0.4)", backgroundColor: "rgba(140,120,255,0.06)" },
        },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontFamily: '"DM Sans", sans-serif' } } },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#16152a",
          border: "1px solid rgba(140, 120, 255, 0.1)",
        },
      },
    },
  },
});

// ── Search bar (fora do componente) ──
const SearchWrap = styled("div")({
  position: "relative",
  display: "flex",
  alignItems: "center",
  borderRadius: 7,
  backgroundColor: "rgba(140, 120, 255, 0.07)",
  border: "1px solid rgba(140, 120, 255, 0.12)",
  transition: "background 0.15s, border-color 0.15s",
  "&:focus-within": {
    backgroundColor: "rgba(140, 120, 255, 0.11)",
    borderColor: "rgba(140, 120, 255, 0.38)",
  },
});

const SearchIconBox = styled("div")({
  padding: "0 10px 0 12px",
  position: "absolute",
  top: 0, bottom: 0,
  display: "flex",
  alignItems: "center",
  pointerEvents: "none",
  color: "rgba(140, 120, 255, 0.45)",
});

const SearchInput = styled("input")({
  color: "#dcd7f5",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: "8px 12px 8px 38px",
  width: "22ch",
  fontSize: "0.84rem",
  fontFamily: '"DM Sans", sans-serif',
  "&::placeholder": { color: "rgba(220, 215, 245, 0.22)" },
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
  if (diff < 7) return `${diff}d`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem`;
  return d.toLocaleDateString("pt-BR");
}

// ── Chip styles ──
const chipSx = (active) => ({
  fontFamily: '"DM Sans", sans-serif',
  fontSize: "0.74rem",
  height: 28,
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  ...(active
    ? {
        backgroundColor: "rgba(140,120,255,0.2)",
        borderColor: "rgba(140,120,255,0.5)",
        color: "#c4baff",
        "& .MuiChip-deleteIcon": { color: "rgba(196,186,255,0.5)", "&:hover": { color: "#c4baff" } },
      }
    : {
        backgroundColor: "transparent",
        borderColor: "rgba(140,120,255,0.15)",
        color: "rgba(220,215,245,0.45)",
        "&:hover": { borderColor: "rgba(140,120,255,0.35)", color: "rgba(220,215,245,0.8)" },
        "& .MuiChip-deleteIcon": { color: "rgba(220,215,245,0.25)", "&:hover": { color: "rgba(220,215,245,0.6)" } },
      }),
});

// ── Migração ──
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
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [currentBook, setCurrentBook] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  const fetchGroups = useCallback(async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "groups"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
      return ta - tb;
    });
    setGroups(list);
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
    if (user) { fetchBooks(user.uid); fetchGroups(user.uid); }
    else { setBooks([]); setGroups([]); setActiveGroup(null); }
  }, [user, fetchBooks, fetchGroups]);

  const handleSignIn = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleSignOut = () => { setAnchorEl(null); signOut(auth); };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const docRef = await addDoc(collection(db, "users", user.uid, "groups"), {
      name,
      createdAt: serverTimestamp(),
    });
    setGroups((prev) => [...prev, { id: docRef.id, name, createdAt: new Date() }]);
    setNewGroupName("");
    setNewGroupOpen(false);
  };

  const deleteGroup = async (groupId) => {
    await deleteDoc(doc(db, "users", user.uid, "groups", groupId));
    const toUpdate = books.filter((b) => b.groupId === groupId);
    if (toUpdate.length > 0) {
      const batch = writeBatch(db);
      toUpdate.forEach((b) => batch.update(doc(db, "users", user.uid, "books", b.id), { groupId: "" }));
      await batch.commit();
      setBooks((prev) => prev.map((b) => (b.groupId === groupId ? { ...b, groupId: "" } : b)));
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeGroup === groupId) setActiveGroup(null);
  };

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
      groupId: book.groupId || "",
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
  const displayedBooks = activeGroup
    ? filtered.filter((b) => b.groupId === activeGroup)
    : filtered;

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
          <Typography sx={{ color: "#5a5878", fontSize: "0.85rem", fontFamily: '"DM Mono", monospace', letterSpacing: "0.1em" }}>
            carregando…
          </Typography>
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
            background: "#0d0c1a",
            gap: 0,
          }}
        >
          {/* Divisor decorativo topo */}
          <Box sx={{
            width: 1,
            height: 1,
            background: "rgba(140, 120, 255, 0.35)",
            mb: 5,
            animation: "fadeIn 0.8s ease both",
          }} />

          <Box sx={{ textAlign: "center", animation: "fadeIn 0.7s 0.1s ease both" }}>
            <Typography
              sx={{
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
                fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
                fontWeight: 300,
                color: "#dcd7f5",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                mb: 1.2,
              }}
            >
              ChapterKeeper
            </Typography>
            <Typography
              sx={{
                fontFamily: '"DM Mono", monospace',
                fontSize: "0.72rem",
                color: "#5a5878",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                mb: 5,
              }}
            >
              biblioteca pessoal
            </Typography>

            <Button
              variant="contained"
              onClick={handleSignIn}
              sx={{
                px: 4,
                py: 1.15,
                fontSize: "0.85rem",
                letterSpacing: "0.04em",
                borderRadius: "6px",
              }}
            >
              Entrar com Google
            </Button>
          </Box>

          {/* Divisor decorativo fundo */}
          <Box sx={{
            width: 1,
            height: 1,
            background: "rgba(140, 120, 255, 0.35)",
            mt: 5,
            animation: "fadeIn 0.8s ease both",
          }} />
        </Box>
      </ThemeProvider>
    );
  }

  // ── App ──
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>

        {/* Navbar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: "rgba(13, 12, 26, 0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: "1px solid rgba(140, 120, 255, 0.1)",
          }}
        >
          <Toolbar sx={{ minHeight: "50px !important", gap: 2 }}>

            {/* Logo */}
            <Typography
              sx={{
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
                fontSize: "1.2rem",
                fontWeight: 300,
                color: "#dcd7f5",
                letterSpacing: "-0.02em",
                flexGrow: 1,
                lineHeight: 1,
              }}
            >
              ChapterKeeper
            </Typography>

            {/* Contagem */}
            <Typography
              sx={{
                fontFamily: '"DM Mono", monospace',
                fontSize: "0.7rem",
                color: "#5a5878",
                letterSpacing: "0.08em",
                display: { xs: "none", sm: "block" },
              }}
            >
              {books.length} {books.length === 1 ? "livro" : "livros"}
            </Typography>

            {/* Busca */}
            <SearchWrap>
              <SearchIconBox>
                <SearchIcon sx={{ fontSize: 15 }} />
              </SearchIconBox>
              <SearchInput
                placeholder="buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </SearchWrap>

            {/* Avatar */}
            <Tooltip title={user.displayName || user.email}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.4 }}>
                <Avatar src={user.photoURL} alt={user.displayName} sx={{ width: 28, height: 28 }} />
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <MenuItem disabled sx={{ fontSize: "0.76rem", opacity: "1 !important", color: "#5a5878" }}>
                {user.email}
              </MenuItem>
              <MenuItem onClick={handleSignOut} sx={{ fontSize: "0.84rem", color: "#dcd7f5" }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5, opacity: 0.6 }} />
                Sair
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Grupo chips */}
        <Box
          sx={{
            position: "sticky",
            top: "50px",
            zIndex: 900,
            background: "rgba(13, 12, 26, 0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(140,120,255,0.08)",
            px: { xs: 2, md: 4 },
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Chip
            label="Todos"
            size="small"
            variant="outlined"
            onClick={() => setActiveGroup(null)}
            sx={chipSx(activeGroup === null)}
          />
          {groups.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              size="small"
              variant="outlined"
              onClick={() => setActiveGroup(g.id)}
              onDelete={() => deleteGroup(g.id)}
              sx={chipSx(activeGroup === g.id)}
            />
          ))}
          <Tooltip title="Novo grupo">
            <IconButton
              size="small"
              onClick={() => setNewGroupOpen(true)}
              sx={{
                color: "rgba(140,120,255,0.4)",
                width: 26,
                height: 26,
                flexShrink: 0,
                "&:hover": { color: "#8c78ff", background: "rgba(140,120,255,0.1)" },
              }}
            >
              <AddIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Dialog: novo grupo */}
        <Dialog open={newGroupOpen} onClose={() => { setNewGroupOpen(false); setNewGroupName(""); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: "1rem" }}>Novo grupo</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="Nome do grupo…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              margin="dense"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => { setNewGroupOpen(false); setNewGroupName(""); }}>Cancelar</Button>
            <Button variant="contained" onClick={createGroup} disabled={!newGroupName.trim()}>Criar</Button>
          </DialogActions>
        </Dialog>

        {/* Grade */}
        <Container maxWidth="xl" sx={{ pt: 3 }}>
          <div className="catalog">
            {displayedBooks.map((book, index) => (
              <div
                key={book.id}
                className="book-item"
                style={{ animationDelay: `${Math.min(index * 0.04, 0.6)}s` }}
                onClick={() => window.open(book.url, "_blank")}
              >
                <div className="book-cover-wrap">
                  {book.imageUrl ? (
                    <img
                      src={book.imageUrl}
                      alt={book.title}
                      className="book-cover"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div className="book-cover-placeholder">
                      <span className="placeholder-title">{book.title}</span>
                      {book.chapter && (
                        <span className="placeholder-chapter">cap. {book.chapter}</span>
                      )}
                    </div>
                  )}
                  <div className="book-edit-btn" onClick={(e) => openEdit(book, e)} title="Editar">
                    <EditIcon sx={{ fontSize: 11 }} />
                  </div>
                </div>
                <div className="book-info">
                  <p className="book-title">{book.title}</p>
                  {book.chapter && <p className="book-chapter">cap. {book.chapter}</p>}
                  {book.updatedAt && <p className="book-date">{formatDate(book.updatedAt)}</p>}
                </div>
              </div>
            ))}

            {/* Card adicionar */}
            <div
              className="book-item book-item--add"
              onClick={() => { setCurrentBook(null); setOpenForm(true); }}
            >
              <div className="book-cover-wrap">
                <div className="add-content">
                  <AddIcon sx={{ fontSize: 22, color: "rgba(140,120,255,0.3)" }} />
                  <span className="add-label">adicionar</span>
                </div>
              </div>
            </div>
          </div>
        </Container>

        <BookForm
          open={openForm}
          handleClose={() => setOpenForm(false)}
          saveBook={saveBook}
          deleteBook={deleteBook}
          currentBook={currentBook}
          groups={groups}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
