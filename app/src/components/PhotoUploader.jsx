import { useEffect, useRef, useState } from 'react';
import {
  addPhotos,
  deletePhoto,
  getAllPhotos,
  detectTypeFromFilename,
  deriveLabelFromFilename,
} from '../utils/photosStore';
import { compressImageFiles } from '../utils/imageCompress';

const PHOTO_TYPES = [
  { value: 'salon',     label: 'Salon/S\u00e9jour' },
  { value: 'cuisine',   label: 'Cuisine' },
  { value: 'chambre',   label: 'Chambre' },
  { value: 'sdb',       label: 'Salle de bain' },
  { value: 'wc',        label: 'WC' },
  { value: 'bureau',    label: 'Bureau' },
  { value: 'exterieur', label: 'Ext\u00e9rieur' },
  { value: 'autre',     label: 'Autre' },
];

const styles = `
  .photo-uploader {
    margin-top: 12px;
    border-top: 1px solid #f0f0f0;
    padding-top: 12px;
  }

  .photo-uploader-title {
    font-size: 12px;
    font-weight: 600;
    color: #555;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .photo-uploader-clear {
    background: none;
    border: none;
    color: #888;
    font-size: 11px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    font-family: inherit;
  }
  .photo-uploader-clear:hover { color: #d33; }

  .photo-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 2px dashed #d5d5d5;
    background: #fafafa;
    border-radius: 10px;
    padding: 14px 10px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 12px;
    color: #666;
    user-select: none;
    box-sizing: border-box;
    width: 100%;
  }
  .photo-dropzone:hover,
  .photo-dropzone.is-dragover {
    border-color: #4a6cf7;
    background: #f0f4ff;
    color: #4a6cf7;
  }
  .photo-dropzone.is-busy {
    opacity: 0.6;
    cursor: progress;
    pointer-events: none;
  }
  .photo-dropzone-icon {
    font-size: 18px;
    display: block;
    margin-bottom: 4px;
  }
  .photo-dropzone-hint {
    margin-top: 4px;
    font-size: 10px;
    color: #999;
  }

  .photo-uploader-error {
    margin-top: 8px;
    background: #fff2f2;
    border: 1px solid #ffcaca;
    color: #b13030;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
  }

  .uploaded-grid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .uploaded-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f0f0f0;
    border: 1px solid #ececec;
  }
  .uploaded-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .uploaded-item-meta {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
    padding: 16px 6px 4px;
    color: white;
    font-size: 10px;
    line-height: 1.2;
  }
  .uploaded-item-type {
    display: inline-block;
    background: rgba(74,108,247,0.9);
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 2px;
  }
  .uploaded-item-label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uploaded-item-delete {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0,0,0,0.55);
    color: white;
    border: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .uploaded-item:hover .uploaded-item-delete,
  .uploaded-item:focus-within .uploaded-item-delete {
    opacity: 1;
  }
  .uploaded-item-delete:hover { background: #d33; }
`;

/**
 * PhotoUploader : drop zone + grille des photos uploadees (IndexedDB).
 *
 * Props :
 *   onChange (callback) : appele apres chaque ajout/suppression avec la liste
 *                         a jour des entrees IDB ([{ id, type, label, blob, ... }]).
 *                         Permet au parent (Step1) de regenerer le carrousel.
 */
export default function PhotoUploader({ onChange }) {
  const [items, setItems] = useState([]); // [{ id, type, label, blob, src }]
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  // On garde une ref des object URLs deja crees pour pouvoir les revoker proprement.
  const urlsRef = useRef(new Map()); // id -> objectURL

  const refreshItems = async () => {
    const raw = await getAllPhotos();
    // Cree un objectURL par item (ou reutilise celui deja en cache)
    const next = raw.map((p) => {
      if (!urlsRef.current.has(p.id)) {
        urlsRef.current.set(p.id, URL.createObjectURL(p.blob));
      }
      return {
        id: p.id,
        type: p.type,
        label: p.label,
        blob: p.blob,
        order: p.order || 0,
        filename: p.filename,
        src: urlsRef.current.get(p.id),
      };
    });
    // Nettoie les URLs orphelines (photos supprimees)
    const liveIds = new Set(next.map((n) => n.id));
    for (const [id, url] of urlsRef.current.entries()) {
      if (!liveIds.has(id)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        urlsRef.current.delete(id);
      }
    }
    setItems(next);
    if (typeof onChange === 'function') onChange(raw);
  };

  // Init : charge les photos deja en IDB
  useEffect(() => {
    refreshItems().catch((err) => {
      console.error('[PhotoUploader] init', err);
      setError('Impossible de charger les photos enregistr\u00e9es.');
    });
    // Capture la ref dans une variable locale pour le cleanup (evite la
    // warning react-hooks/exhaustive-deps sur un ref.current "stale").
    const urlsCache = urlsRef.current;
    return () => {
      for (const url of urlsCache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      urlsCache.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Aucun fichier image valide.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressImageFiles(files, { maxDim: 1600, quality: 0.75 });
      const payload = compressed.map(({ file, blob }) => ({
        blob,
        filename: file.name,
        type: detectTypeFromFilename(file.name),
        label: deriveLabelFromFilename(file.name, detectTypeFromFilename(file.name)),
      }));
      await addPhotos(payload);
      await refreshItems();
    } catch (err) {
      console.error('[PhotoUploader] handleFiles', err);
      setError(err.message || 'Erreur lors de l\u2019ajout des photos.');
    } finally {
      setBusy(false);
    }
  };

  const onInputChange = (e) => {
    const files = e.target.files;
    handleFiles(files);
    // reset l'input pour permettre de re-uploader le meme fichier
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDelete = async (id) => {
    try {
      await deletePhoto(id);
      await refreshItems();
    } catch (err) {
      console.error('[PhotoUploader] delete', err);
      setError('Suppression impossible.');
    }
  };

  const handleClearAll = async () => {
    if (!items.length) return;
    if (!window.confirm(`Supprimer les ${items.length} photo(s) upload\u00e9e(s) ?`)) return;
    try {
      // Suppression en parallele : pas d'ordre necessaire entre les deletes.
      await Promise.all(items.map((it) => deletePhoto(it.id)));
      await refreshItems();
    } catch (err) {
      console.error('[PhotoUploader] clearAll', err);
      setError('Suppression impossible.');
    }
  };

  return (
    <div className="photo-uploader">
      <style>{styles}</style>

      <div className="photo-uploader-title">
        <span>Ajouter des photos</span>
        {items.length > 0 && (
          <button
            type="button"
            className="photo-uploader-clear"
            onClick={handleClearAll}
          >
            Tout supprimer
          </button>
        )}
      </div>

      <label
        className={`photo-dropzone${dragOver ? ' is-dragover' : ''}${busy ? ' is-busy' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span className="photo-dropzone-icon" aria-hidden="true">
          {busy ? '\u23f3' : '+'}
        </span>
        <span className="photo-dropzone-text">
          {busy
            ? 'Compression et enregistrement\u2026'
            : 'D\u00e9poser des images ou cliquer'}
        </span>
        <span className="photo-dropzone-hint">
          {'JPG, PNG, WebP \u2014 compress\u00e9es localement (max 1600px)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </label>

      {error && (
        <div className="photo-uploader-error" role="alert">{error}</div>
      )}

      {items.length > 0 && (
        <div className="uploaded-grid">
          {items.map((p) => {
            const typeMeta = PHOTO_TYPES.find((t) => t.value === p.type);
            return (
              <div key={p.id} className="uploaded-item">
                <img src={p.src} alt={p.label} />
                <button
                  type="button"
                  className="uploaded-item-delete"
                  aria-label={`Supprimer ${p.label}`}
                  onClick={() => handleDelete(p.id)}
                >&times;</button>
                <div className="uploaded-item-meta">
                  <span className="uploaded-item-type">
                    {typeMeta ? typeMeta.label : p.type}
                  </span>
                  <span className="uploaded-item-label">{p.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
