import React, { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from "@mui/material";

function BookForm({ open, handleClose, saveBook, currentBook }) {
  const [form, setForm] = useState({ id: null, title: "", chapter: "", url: "" });

  useEffect(() => {
    if (currentBook) {
      setForm(currentBook);
    } else {
      setForm({ id: null, title: "", chapter: "", url: "" });
    }
  }, [currentBook]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (!form.title || !form.url) {
      alert("Preencha pelo menos o título e o link!");
      return;
    }
    saveBook(form);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{form.id ? "Editar Livro" : "Adicionar Livro"}</DialogTitle>
      <DialogContent>
        <TextField
          label="Título"
          name="title"
          fullWidth
          margin="dense"
          value={form.title}
          onChange={handleChange}
        />
        <TextField
          label="Capítulo"
          name="chapter"
          fullWidth
          margin="dense"
          value={form.chapter}
          onChange={handleChange}
        />
        <TextField
          label="Link"
          name="url"
          fullWidth
          margin="dense"
          value={form.url}
          onChange={handleChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {form.id ? "Salvar" : "Adicionar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BookForm;
