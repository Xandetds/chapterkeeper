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
  Divider,
  createTheme,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
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
    MuiMenuItem: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: "rgba(140, 120, 255, 0.14)",
            "&:hover": { backgroundColor: "rgba(140, 120, 255, 0.2)" },
          },
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
  width: "20ch",
  fontSize: "0.84rem",
  fontFamily: '"DM Sans", sans-serif',
  transition: "width 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
  "&:focus": { width: "28ch" },
  "&::placeholder": { color: "rgba(220, 215, 245, 0.22)" },
  "@media (max-width: 600px)": {
    width: "12ch",
    "&:focus": { width: "16ch" },
  },
});

// ── Marca: lua crescente (mesma do favicon) ──
function Moon({ size = 18, style }) {
  return (
    <svg viewBox="6 6 20 20" width={size} height={size} style={style} aria-hidden="true">
      <path d="M21 8.5a9 9 0 1 0 0 15 7 7 0 1 1 0-15z" fill="currentColor" />
    </svg>
  );
}

// ── Utilitários ──
// Matiz estável por título (faixa azul→roxo) para os placeholders de capa
function titleHue(title = "") {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 222 + (h % 76);
}

// Busca sem diferenciar acentos/maiúsculas
function normalize(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
  } catch {
    // URL inválida — sem nome extraível
  }
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
  const [booksLoading, setBooksLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [activeGroups, setActiveGroups] = useState([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [currentBook, setCurrentBook] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [draggedGroup, setDraggedGroup] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  const fetchGroups = useCallback(async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "groups"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      // etiquetas sem order (antigas) vão para o fim, ordenadas por criação
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
      return ta - tb;
    });
    setGroups(list);
  }, []);

  const fetchBooks = useCallback(async (uid) => {
    setBooksLoading(true);
    try {
      await migrateOldData(uid);
      const snap = await getDocs(collection(db, "users", uid, "books"));
      const list = snap.docs.map((d) => {
        const { id: _, ...data } = d.data();
        return {
          id: d.id,
          ...data,
          // compat: livros antigos têm groupId (string única)
          groupIds: data.groupIds ?? (data.groupId ? [data.groupId] : []),
        };
      });
      list.sort((a, b) => {
        const ta = a.updatedAt?.toDate?.() ?? new Date(a.updatedAt ?? 0);
        const tb = b.updatedAt?.toDate?.() ?? new Date(b.updatedAt ?? 0);
        return tb - ta;
      });
      setBooks(list);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) { fetchBooks(user.uid); fetchGroups(user.uid); }
    else { setBooks([]); setGroups([]); setActiveGroups([]); }
  }, [user, fetchBooks, fetchGroups]);

  const handleSignIn = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleSignOut = () => { setAnchorEl(null); signOut(auth); };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const docRef = await addDoc(collection(db, "users", user.uid, "groups"), {
      name,
      order: groups.length,
      createdAt: serverTimestamp(),
    });
    setGroups((prev) => [...prev, { id: docRef.id, name, order: prev.length, createdAt: new Date() }]);
    setNewGroupName("");
    setNewGroupOpen(false);
  };

  const deleteGroup = async (groupId) => {
    await deleteDoc(doc(db, "users", user.uid, "groups", groupId));
    const toUpdate = books.filter((b) => b.groupIds?.includes(groupId));
    if (toUpdate.length > 0) {
      const batch = writeBatch(db);
      toUpdate.forEach((b) =>
        batch.update(doc(db, "users", user.uid, "books", b.id), {
          groupIds: b.groupIds.filter((id) => id !== groupId),
        })
      );
      await batch.commit();
      setBooks((prev) =>
        prev.map((b) =>
          b.groupIds?.includes(groupId)
            ? { ...b, groupIds: b.groupIds.filter((id) => id !== groupId) }
            : b
        )
      );
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setActiveGroups((prev) => prev.filter((id) => id !== groupId));
  };

  const toggleGroupFilter = (groupId) =>
    setActiveGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );

  const reorderGroups = async (targetId) => {
    if (!draggedGroup || draggedGroup === targetId) {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }
    const list = [...groups];
    const from = list.findIndex((g) => g.id === draggedGroup);
    const to = list.findIndex((g) => g.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setGroups(list.map((g, i) => ({ ...g, order: i })));
    setDraggedGroup(null);
    setDragOverGroup(null);
    const batch = writeBatch(db);
    list.forEach((g, i) => batch.update(doc(db, "users", user.uid, "groups", g.id), { order: i }));
    await batch.commit();
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
      groupIds: book.groupIds || [],
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

  const filtered = books.filter((b) => normalize(b.title).includes(normalize(query)));
  const displayedBooks = activeGroups.length
    ? filtered.filter((b) => activeGroups.every((id) => b.groupIds?.includes(id)))
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
            background:
              "radial-gradient(55% 42% at 50% 32%, rgba(140, 120, 255, 0.09), transparent 70%), #0d0c1a",
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            {/* Lua */}
            <Box
              sx={{
                color: "#8c78ff",
                mb: 3,
                animation: "moonRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
                filter: "drop-shadow(0 0 26px rgba(140, 120, 255, 0.45))",
                lineHeight: 0,
              }}
            >
              <Moon size={46} />
            </Box>

            <Typography
              sx={{
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
                fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
                fontWeight: 300,
                color: "#dcd7f5",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                mb: 1.6,
                animation: "fadeIn 0.7s 0.15s ease both",
              }}
            >
              ChapterKeeper
            </Typography>

            {/* Hairline */}
            <Box
              sx={{
                width: 64,
                height: "1px",
                mx: "auto",
                mb: 1.6,
                background:
                  "linear-gradient(90deg, transparent, rgba(140, 120, 255, 0.55), transparent)",
                animation: "lineGrow 0.8s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            />

            <Typography
              sx={{
                fontFamily: '"DM Mono", monospace',
                fontSize: "0.72rem",
                color: "#5a5878",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                mb: 5,
                animation: "fadeIn 0.7s 0.3s ease both",
              }}
            >
              sua estante de capítulos
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
                animation: "fadeIn 0.7s 0.45s ease both",
                boxShadow: "0 6px 28px rgba(140, 120, 255, 0.22)",
                "&:hover": { boxShadow: "0 8px 34px rgba(140, 120, 255, 0.34)" },
              }}
            >
              Entrar com Google
            </Button>
          </Box>
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
              <Box sx={{ color: "#8c78ff", lineHeight: 0, filter: "drop-shadow(0 0 8px rgba(140,120,255,0.4))" }}>
                <Moon size={17} />
              </Box>
              <Typography
                sx={{
                  fontFamily: '"Fraunces", serif',
                  fontStyle: "italic",
                  fontSize: "1.2rem",
                  fontWeight: 300,
                  color: "#dcd7f5",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                ChapterKeeper
              </Typography>
            </Box>

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

            {/* Chips das etiquetas ativas */}
            {activeGroups.length > 0 && (
              <Box
                sx={{
                  display: { xs: "none", sm: "flex" },
                  alignItems: "center",
                  gap: 0.5,
                  maxWidth: "32vw",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {activeGroups.map((id) => (
                  <Chip
                    key={id}
                    size="small"
                    variant="outlined"
                    label={groups.find((g) => g.id === id)?.name}
                    onDelete={() => toggleGroupFilter(id)}
                    sx={{ ...chipSx(true), flexShrink: 0 }}
                  />
                ))}
              </Box>
            )}

            {/* Filtro por etiqueta */}
            <Tooltip title="Filtrar por etiqueta">
              <IconButton
                size="small"
                onClick={(e) => setFilterAnchor(e.currentTarget)}
                sx={{
                  color: activeGroups.length ? "#8c78ff" : "rgba(220, 215, 245, 0.4)",
                  border: "1px solid",
                  borderColor: activeGroups.length ? "rgba(140,120,255,0.45)" : "rgba(140,120,255,0.12)",
                  borderRadius: "7px",
                  width: 34,
                  height: 34,
                  background: activeGroups.length ? "rgba(140,120,255,0.12)" : "rgba(140,120,255,0.05)",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    color: "#a090ff",
                    borderColor: "rgba(140,120,255,0.4)",
                    background: "rgba(140,120,255,0.1)",
                  },
                }}
              >
                {activeGroups.length ? <FilterAltIcon sx={{ fontSize: 17 }} /> : <FilterAltOutlinedIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>

            {/* Menu de filtro */}
            <Menu
              anchorEl={filterAnchor}
              open={Boolean(filterAnchor)}
              onClose={() => setFilterAnchor(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              slotProps={{ paper: { sx: { minWidth: 190, mt: 0.5 } } }}
            >
              <MenuItem
                selected={activeGroups.length === 0}
                onClick={() => { setActiveGroups([]); setFilterAnchor(null); }}
                sx={{ fontSize: "0.84rem", display: "flex", justifyContent: "space-between", gap: 2 }}
              >
                Todos
                <Typography component="span" sx={{ fontFamily: '"DM Mono", monospace', fontSize: "0.68rem", color: "#5a5878" }}>
                  {books.length}
                </Typography>
              </MenuItem>
              {groups.map((g) => (
                <MenuItem
                  key={g.id}
                  selected={activeGroups.includes(g.id)}
                  onClick={() => toggleGroupFilter(g.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedGroup(g.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverGroup !== g.id) setDragOverGroup(g.id);
                  }}
                  onDragLeave={() => setDragOverGroup((prev) => (prev === g.id ? null : prev))}
                  onDrop={(e) => { e.preventDefault(); reorderGroups(g.id); }}
                  onDragEnd={() => { setDraggedGroup(null); setDragOverGroup(null); }}
                  sx={{
                    fontSize: "0.84rem",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1.5,
                    opacity: draggedGroup === g.id ? 0.35 : 1,
                    boxShadow:
                      dragOverGroup === g.id && draggedGroup !== g.id
                        ? "inset 0 2px 0 0 #8c78ff"
                        : "none",
                    transition: "opacity 0.15s ease, box-shadow 0.1s ease",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <DragIndicatorIcon
                      sx={{ fontSize: 14, color: "rgba(220,215,245,0.2)", cursor: "grab", flexShrink: 0 }}
                    />
                    {g.name}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography component="span" sx={{ fontFamily: '"DM Mono", monospace', fontSize: "0.68rem", color: "#5a5878" }}>
                      {books.filter((b) => b.groupIds?.includes(g.id)).length}
                    </Typography>
                    <Tooltip title="Excluir etiqueta">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                        sx={{
                          width: 20,
                          height: 20,
                          color: "rgba(220,215,245,0.25)",
                          "&:hover": { color: "#ff7878", background: "rgba(255,120,120,0.08)" },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem
                onClick={() => { setFilterAnchor(null); setNewGroupOpen(true); }}
                sx={{ fontSize: "0.82rem", color: "#8c78ff" }}
              >
                <AddIcon sx={{ fontSize: 15, mr: 1 }} />
                Nova etiqueta
              </MenuItem>
            </Menu>

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

        {/* Dialog: novo grupo */}
        <Dialog open={newGroupOpen} onClose={() => { setNewGroupOpen(false); setNewGroupName(""); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: "1rem" }}>Nova etiqueta</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="Nome da etiqueta…"
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
          {booksLoading ? (
            <div className="catalog">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="skeleton-cover" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-line--short" />
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="empty-state">
              <span className="empty-moon"><Moon size={40} /></span>
              <p className="empty-title">Sua estante está vazia</p>
              <p className="empty-sub">guarde o capítulo onde você parou</p>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setCurrentBook(null); setOpenForm(true); }}
              >
                Adicionar primeiro livro
              </Button>
            </div>
          ) : displayedBooks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-moon"><Moon size={32} /></span>
              <p className="empty-title">Nada por aqui</p>
              <p className="empty-sub">
                {query
                  ? `nenhum resultado para “${query}”`
                  : activeGroups.length > 1
                    ? "nenhum livro com essas etiquetas"
                    : "esta etiqueta ainda não tem livros"}
              </p>
            </div>
          ) : (
            <div className="catalog">
              {displayedBooks.map((book, index) => (
                <div
                  key={book.id}
                  className="book-item"
                  style={{ animationDelay: `${Math.min(index * 0.04, 0.6)}s` }}
                  onClick={() => window.open(book.url, "_blank", "noopener,noreferrer")}
                >
                  <div className="book-cover-wrap">
                    {book.imageUrl ? (
                      <img
                        src={book.imageUrl}
                        alt={book.title}
                        className="book-cover"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div
                        className="book-cover-placeholder"
                        style={{ "--ph": titleHue(book.title) }}
                      >
                        <span className="placeholder-initial">
                          {(book.title || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="placeholder-title">{book.title}</span>
                        {book.chapter && (
                          <span className="placeholder-chapter">cap. {book.chapter}</span>
                        )}
                      </div>
                    )}
                    <div className="book-hover-overlay">continuar →</div>
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
          )}
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
