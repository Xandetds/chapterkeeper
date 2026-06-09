import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString("pt-BR");
}

const emptyForm = { id: null, title: "", chapter: "", url: "", imageUrl: "" };

function BookForm({ open, handleClose, saveBook, deleteBook, currentBook }) {
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (currentBook) {
      setForm({
        id: currentBook.id,
        title: currentBook.title || "",
        chapter: currentBook.chapter || "",
        url: currentBook.url || "",
        imageUrl: currentBook.imageUrl || "",
      });
    } else {
      setForm(emptyForm);
    }
    setConfirmDelete(false);
  }, [currentBook, open]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = () => {
    if (!form.title || !form.url) {
      alert("Preencha pelo menos o título e o link!");
      return;
    }
    saveBook(form);
    handleClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteBook(form.id);
    handleClose();
  };

  const isEditing = Boolean(form.id);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? "Editar mangá" : "Adicionar mangá"}</DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column" }}>
        <TextField
          label="Título"
          name="title"
          fullWidth
          margin="dense"
          value={form.title}
          onChange={handleChange}
          autoFocus
        />
        <TextField
          label="Capítulo atual"
          name="chapter"
          fullWidth
          margin="dense"
          value={form.chapter}
          onChange={handleChange}
          placeholder="Ex: 42"
        />
        <TextField
          label="Link do capítulo"
          name="url"
          fullWidth
          margin="dense"
          value={form.url}
          onChange={handleChange}
          placeholder="https://..."
        />
        <TextField
          label="URL da capa (opcional)"
          name="imageUrl"
          fullWidth
          margin="dense"
          value={form.imageUrl}
          onChange={handleChange}
          placeholder="https://... (imagem de capa)"
          helperText="Cole a URL de qualquer imagem para exibir como capa no card"
        />

        {isEditing && currentBook?.updatedAt && (
          <>
            <Divider sx={{ mt: 2 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1 }}>
              Última atualização: {formatDate(currentBook.updatedAt)}
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        {isEditing ? (
          <Button
            variant={confirmDelete ? "contained" : "outlined"}
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirmar exclusão" : "Deletar"}
          </Button>
        ) : (
          <Box />
        )}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={() => {
              setConfirmDelete(false);
              handleClose();
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmit}>
            {isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default BookForm;
