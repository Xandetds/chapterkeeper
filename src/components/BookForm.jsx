import React, { useState, useEffect, useRef } from "react";
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
  Tabs,
  Tab,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LinkIcon from "@mui/icons-material/Link";

function formatDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR");
}

const emptyForm = { id: null, title: "", chapter: "", url: "", imageUrl: "", groupId: "" };

function BookForm({ open, handleClose, saveBook, deleteBook, currentBook, groups = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [imageMode, setImageMode] = useState("url"); // "url" | "file"
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentBook) {
      setForm({
        id: currentBook.id,
        title: currentBook.title || "",
        chapter: currentBook.chapter || "",
        url: currentBook.url || "",
        imageUrl: currentBook.imageUrl || "",
        groupId: currentBook.groupId || "",
      });
      setImagePreview(currentBook.imageUrl || "");
      setImageMode("url");
    } else {
      setForm(emptyForm);
      setImagePreview("");
    }
    setImageFile(null);
    setConfirmDelete(false);
    setSaving(false);
  }, [currentBook, open]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setForm((f) => ({ ...f, imageUrl: "" }));
  };

  const handleUrlChange = (e) => {
    setForm({ ...form, imageUrl: e.target.value });
    setImageFile(null);
    setImagePreview(e.target.value);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.url) {
      alert("Preencha pelo menos o título e o link!");
      return;
    }
    setSaving(true);
    await saveBook(form, imageFile || null);
    setSaving(false);
    handleClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteBook(form.id);
    handleClose();
  };

  const handleClose_ = () => {
    setConfirmDelete(false);
    handleClose();
  };

  const isEditing = Boolean(form.id);
  const previewSrc = imageMode === "file" ? imagePreview : (form.imageUrl || imagePreview);

  return (
    <Dialog open={open} onClose={handleClose_} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
        {isEditing ? "Editar livro" : "Adicionar livro"}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
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
          label="Capítulo"
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

        {/* Grupo */}
        {groups.length > 0 && (
          <TextField
            select
            label="Grupo"
            name="groupId"
            fullWidth
            margin="dense"
            value={form.groupId}
            onChange={handleChange}
            SelectProps={{ native: true }}
            sx={{ mt: 0.5 }}
          >
            <option value="">Sem grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </TextField>
        )}

        {/* Imagem */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
            Imagem de capa (opcional)
          </Typography>

          <Tabs
            value={imageMode}
            onChange={(_, v) => setImageMode(v)}
            sx={{
              minHeight: 34,
              mb: 1.5,
              "& .MuiTab-root": { minHeight: 34, py: 0.5, fontSize: "0.8rem", textTransform: "none" },
            }}
          >
            <Tab icon={<LinkIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="URL" value="url" />
            <Tab icon={<UploadFileIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Arquivo local" value="file" />
          </Tabs>

          {imageMode === "url" ? (
            <TextField
              fullWidth
              size="small"
              placeholder="https://... (URL da imagem de capa)"
              value={form.imageUrl}
              onChange={handleUrlChange}
            />
          ) : (
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ textTransform: "none" }}
              >
                {imageFile ? imageFile.name : "Escolher imagem…"}
              </Button>
            </Box>
          )}

          {/* Preview */}
          {previewSrc && (
            <Box
              sx={{
                mt: 1.5,
                width: 80,
                height: 112,
                borderRadius: 1.5,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                flexShrink: 0,
              }}
            >
              <img
                src={previewSrc}
                alt="preview"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </Box>
          )}
        </Box>

        {isEditing && currentBook?.updatedAt && (
          <>
            <Divider sx={{ mt: 2 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
              Última atualização: {formatDate(currentBook.updatedAt)}
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
        {isEditing ? (
          <Button
            variant={confirmDelete ? "contained" : "outlined"}
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirmar" : "Deletar"}
          </Button>
        ) : (
          <Box />
        )}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={handleClose_} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default BookForm;
