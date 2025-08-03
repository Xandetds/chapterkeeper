import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { styled, alpha } from "@mui/material/styles";
import BookForm from "./components/BookForm";
import "./catalog.css";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";

function App() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [currentBook, setCurrentBook] = useState(null);

  // Barra de busca
  const Search = styled("div")(({ theme }) => ({
    position: "relative",
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.25) },
    marginLeft: theme.spacing(2),
    width: "auto",
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
    padding: theme.spacing(1, 1, 1, 4),
    width: "40ch",
    fontSize: "1rem",
  }));

  // Função para gerar cor fixa por domínio
  const colorMap = {};
  const getCardColor = (url) => {
    if (!url) return "#2c2c2c";
    const domain = new URL(url).hostname.replace("www.", "");
    if (!colorMap[domain]) {
      colorMap[domain] = `hsl(${Math.floor(Math.random() * 360)}, 60%, 40%)`;
    }
    return colorMap[domain];
  };

  // Carregar livros do Firestore OU migrar do localStorage
  useEffect(() => {
    const fetchBooks = async () => {
      const querySnapshot = await getDocs(collection(db, "books"));
      if (!querySnapshot.empty) {
        // Se já tem livros no Firestore, usa eles
        const booksList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBooks(booksList);
      } else {
        // Se Firestore estiver vazio, migra do localStorage
        const savedBooks = JSON.parse(localStorage.getItem("books")) || [];
        if (savedBooks.length > 0) {
          for (const book of savedBooks) {
            await addDoc(collection(db, "books"), book);
          }
          setBooks(savedBooks);
          // Marca que já migrou, para não repetir
          localStorage.removeItem("books");
        }
      }
    };
    fetchBooks();
  }, []);

  // Salvar ou editar livro
  const saveBook = async (book) => {
    if (book.id) {
      const ref = doc(db, "books", book.id);
      await updateDoc(ref, {
        title: book.title,
        url: book.url,
        chapter: book.chapter,
      });
      setBooks(books.map((b) => (b.id === book.id ? book : b)));
    } else {
      const docRef = await addDoc(collection(db, "books"), book);
      setBooks([...books, { ...book, id: docRef.id }]);
    }
  };

  // Filtro
  const filteredBooks = books.filter((book) =>
    (book.title || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Box sx={{ backgroundColor: "#121212", minHeight: "100vh" }}>
      {/* Navbar */}
      <AppBar position="static" sx={{ background: "linear-gradient(90deg, #6a11cb, #2575fc)" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ChapterKeeper
          </Typography>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Procurar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Search>
        </Toolbar>
      </AppBar>

      {/* Conteúdo */}
      <Container sx={{ marginTop: "20px" }}>
        <div className="catalog">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="catalog-card"
              style={{ backgroundColor: getCardColor(book.url) }}
              onClick={() => window.open(book.url, "_blank")}
              onContextMenu={(e) => {
                e.preventDefault();
                setCurrentBook(book);
                setOpenForm(true);
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {book.title}
              </Typography>
              <Typography variant="body2">
                Capítulo: {book.chapter || "—"}
              </Typography>
            </div>
          ))}

          {/* Card de adicionar */}
          <div
            className="catalog-card"
            style={{
              border: "2px dashed #555",
              background: "#1e1e1e",
            }}
            onClick={() => {
              setCurrentBook(null);
              setOpenForm(true);
            }}
          >
            <AddIcon sx={{ fontSize: 50, color: "#00bcd4" }} />
          </div>
        </div>
      </Container>

      {/* Modal */}
      <BookForm
        open={openForm}
        handleClose={() => setOpenForm(false)}
        saveBook={saveBook}
        currentBook={currentBook}
      />
    </Box>
  );
}

export default App;
