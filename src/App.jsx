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
import { booksData } from "./data/books";
import BookForm from "./components/BookForm";
import "./catalog.css";

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
      // gera cor aleatória se ainda não existir
      colorMap[domain] = `hsl(${Math.floor(Math.random() * 360)}, 60%, 40%)`;
    }
    return colorMap[domain];
  };

  // Carregar livros
  useEffect(() => {
    const savedBooks = JSON.parse(localStorage.getItem("books"));
    if (Array.isArray(savedBooks) && savedBooks.length > 0) {
      setBooks(savedBooks);
    } else {
      const withIds = booksData.map((book, index) => ({
        id: index + 1,
        ...book,
      }));
      setBooks(withIds);
      localStorage.setItem("books", JSON.stringify(withIds));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("books", JSON.stringify(books));
  }, [books]);

  // Salvar ou editar livro
  const saveBook = (book) => {
    if (book.id) {
      const updated = books.map((b) => (b.id === book.id ? book : b));
      setBooks(updated);
    } else {
      setBooks([...books, { ...book, id: books.length + 1 }]);
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
