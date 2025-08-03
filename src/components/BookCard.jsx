import React, { useState } from "react";
import { Card, CardContent, Typography, Menu, MenuItem } from "@mui/material";

// Função para gerar cores fixas por domínio
const domainColors = {
  neoxscans: "#1976d2",
  unionleitor: "#9c27b0",
  mangadex: "#e65100",
  remangas: "#2e7d32",
  tsuki: "#6a1b9a",
  mangaschan: "#d32f2f",
  default: "#424242",
};

function getDomainColor(url = "") {
  const keys = Object.keys(domainColors);
  for (let key of keys) {
    if (url.includes(key)) return domainColors[key];
  }
  return domainColors.default;
}

function BookCard({ book, onEdit }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <Card
      onClick={() => window.open(book.url, "_blank")}
      onContextMenu={handleContextMenu}
      sx={{
        backgroundColor: getDomainColor(book.url),
        borderRadius: "12px",
        height: 280,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        textAlign: "center",
        boxShadow: "0px 4px 15px rgba(0,0,0,0.5)",
        "&:hover": { transform: "scale(1.03)", transition: "0.3s" },
      }}
    >
      <CardContent sx={{ overflow: "hidden", width: "100%" }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {book.title}
        </Typography>
        <Typography variant="body2">
          Capítulo: {book.chapter || "—"}
        </Typography>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            onEdit(book);
          }}
        >
          Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            window.open(book.url, "_blank");
          }}
        >
          Abrir em nova guia
        </MenuItem>
      </Menu>
    </Card>
  );
}

export default BookCard;
