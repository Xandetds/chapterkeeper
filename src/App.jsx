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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import { styled, alpha } from "@mui/material/styles";
import BookForm from "./components/BookForm";
import "./catalog.css";
import { db, auth, googleProvider } from "./firebase";
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
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

// ── Styled components FORA do App para não recriar a cada render (bug da busca) ──
const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.25) },
  marginLeft: theme.spacing(2),
  display: "flex",
  alignItems: "center",
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled("input")(({ theme }) => ({
  color: "inherit",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: theme.spacing(1, 1, 1, 0),
  paddingLeft: `calc(1em + ${theme.spacing(4)})`,
  width: "30ch",
  fontSize: "1rem",
}));

// ── Utilitários ──

function extractNameFromUrl(url) {
  if (!url) return null;
  try {
    const raw = url.startsWith("http") ? url : "https://" + url;
    const { pathname } = new URL(raw);
    const patterns = [
      { re: /\/leitor\/([^/]+)\/\d+/, sep: "_" },
      { re: /\/manga\/([^/]+)\/cap-/, sep: "-" },
      { re: /\/comics?\/([^/]+)\/cap-/, sep: "-" },
      { re: /\/serie\/([^/]+)\/cap-/, sep: "-" },
      { re: /\/comicz\/([^/]+)\/cap-/, sep: "-" },
      { re: /\/ler\/([^/]+)\/(?:online|cap-)/, sep: "-" },
      { re: /\/capitulos\/(.+?)-capitulo-/, sep: "-" },
      { re: /\/manga\/([^/]+)\/?$/, sep: "-" },
    ];
    for (const { re } of patterns) {
      const match = pathname.match(re);
      if (match) {
        let name = match[1]
          .replace(/_/g, " ")
          .replace(/-/g, " ")
          .replace(/\d+_\d+[\w_]*/g, "")
          .replace(/\s+/g, " ")
          .trim();
        name = name.replace(/\b\w/g, (c) => c.toUpperCase());
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
  if (looksLikeUrl) return extractNameFromUrl(url) || title;
  return title;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff}d atrás`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem atrás`;
  return date.toLocaleDateString("pt-BR");
}

const colorCache = {};
function getCardColor(url) {
  if (!url) return "#2c2c2c";
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    if (!colorCache[domain]) {
      let hash = 0;
      for (let i = 0; i < domain.length; i++) {
        hash = domain.charCodeAt(i) + ((hash << 5) - hash);
      }
      colorCache[domain] = `hsl(${Math.abs(hash) % 360}, 50%, 32%)`;
    }
    return colorCache[domain];
  } catch (_) {
    return "#2c2c2c";
  }
}

// ── Migração: coleção raiz "books" → users/{uid}/books ──
async function migrateOldData(uid) {
  const oldSnap = await getDocs(collection(db, "books"));
  if (oldSnap.empty) return;

  const userBooksRef = collection(db, "users", uid, "books");
  const userSnap = await getDocs(userBooksRef);
  if (!userSnap.empty) return; // usuário já tem dados, não migrar

  // Batch em chunks de 240 docs (240 set + 240 delete = 480 ops < 500 limit)
  const docs = oldSnap.docs;
  for (let i = 0; i < docs.length; i += 240) {
    const batch = writeBatch(db);
    docs.slice(i, i + 240).forEach((oldDoc) => {
      const { id: _storedId, ...rest } = oldDoc.data();
      batch.set(doc(userBooksRef), {
        ...rest,
        title: cleanTitle(rest.title, rest.url),
        imageUrl: rest.imageUrl || "",
        updatedAt: new Date(),
      });
      batch.delete(oldDoc.ref);
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
      const { id: _ignore, ...data } = d.data();
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

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut(auth);
  };

  const saveBook = async (book) => {
    const userBooksRef = collection(db, "users", user.uid, "books");
    const payload = {
      title: book.title,
      chapter: book.chapter || "",
      url: book.url,
      imageUrl: book.imageUrl || "",
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
      const docRef = await addDoc(userBooksRef, payload);
      setBooks((prev) => [{ id: docRef.id, ...payload, updatedAt: new Date() }, ...prev]);
    }
  };

  const deleteBook = async (bookId) => {
    await deleteDoc(doc(db, "users", user.uid, "books", bookId));
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  const filteredBooks = books.filter((b) =>
    (b.title || "").toLowerCase().includes(query.toLowerCase())
  );

  // Loading
  if (authLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#121212" }}>
        <Typography sx={{ color: "#aaa" }}>Carregando…</Typography>
      </Box>
    );
  }

  // Login
  if (!user) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#121212",
          gap: 2,
        }}
      >
        <Typography variant="h3" sx={{ color: "white", fontWeight: 700 }}>
          📖 ChapterKeeper
        </Typography>
        <Typography sx={{ color: "#aaa", mb: 2 }}>
          Sua biblioteca de mangás pessoal
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleSignIn}
          sx={{
            background: "linear-gradient(90deg, #6a11cb, #2575fc)",
            px: 5,
            py: 1.5,
            fontSize: "1rem",
            borderRadius: 2,
            textTransform: "none",
          }}
        >
          Entrar com Google
        </Button>
      </Box>
    );
  }

  // App
  return (
    <Box sx={{ backgroundColor: "#121212", minHeight: "100vh" }}>
      <AppBar position="static" sx={{ background: "linear-gradient(90deg, #6a11cb, #2575fc)" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            📖 ChapterKeeper
          </Typography>

          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Procurar mangá…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Search>

          <Tooltip title={user.displayName || user.email}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 2 }}>
              <Avatar src={user.photoURL} alt={user.displayName} sx={{ width: 34, height: 34 }} />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled sx={{ fontSize: "0.8rem", color: "#aaa", opacity: "1 !important" }}>
              {user.email}
            </MenuItem>
            <MenuItem onClick={handleSignOut}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 3, pb: 4 }}>
        <div className="catalog">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="catalog-card"
              style={book.imageUrl ? {} : { backgroundColor: getCardColor(book.url) }}
              onClick={() => window.open(book.url, "_blank")}
              onContextMenu={(e) => {
                e.preventDefault();
                setCurrentBook(book);
                setOpenForm(true);
              }}
            >
              {book.imageUrl ? (
                <>
                  <img
                    src={book.imageUrl}
                    alt={book.title}
                    className="card-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.background = getCardColor(book.url);
                    }}
                  />
                  <div className="card-info card-info--image">
                    <span className="card-title">{book.title}</span>
                    <span className="card-meta">
                      {book.chapter ? `Cap. ${book.chapter}` : ""}
                      {book.updatedAt && (
                        <span className="card-date"> · {formatDate(book.updatedAt)}</span>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="card-info">
                  <span className="card-title">{book.title}</span>
                  {book.chapter && (
                    <span className="card-meta">Cap. {book.chapter}</span>
                  )}
                  {book.updatedAt && (
                    <span className="card-date">{formatDate(book.updatedAt)}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Card de adicionar */}
          <div
            className="catalog-card catalog-card--add"
            onClick={() => {
              setCurrentBook(null);
              setOpenForm(true);
            }}
          >
            <AddIcon sx={{ fontSize: 48, color: "#00bcd4" }} />
            <span className="card-meta" style={{ marginTop: 6 }}>Adicionar</span>
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
  );
}

export default App;
